-- jodal.pro 회원 진도·성취도 스키마
-- schema.sql(게시판·후기·신고) 다음에 실행한다. 여러 번 실행해도 안전하다.
-- 개인 학습기록이므로 남이 읽지 못한다. 모든 표는 본인 것만 보고 쓴다.

-- ────────────────────────────────────────────── 1. 회원 표시 정보
-- 이메일은 auth.users에 있고 여기에 복사하지 않는다. 게시판 작성자명으로 닉네임을 쓴다.
create table if not exists public.profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  nickname     text not null default '수험생' check (char_length(nickname) between 1 and 24),
  target_round text check (char_length(target_round) <= 40),   -- 목표 회차. 예: 2026년 제1회
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- 가입하면 프로필을 자동으로 만든다.
create or replace function public.on_auth_user_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, nickname)
  values (
    new.id,
    left(coalesce(
      nullif(trim(new.raw_user_meta_data->>'name'), ''),
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''),   -- 구글·카카오가 주는 이름
      nullif(trim(new.raw_user_meta_data->>'nickname'), ''),
      '수험생'
    ), 24)
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;
drop trigger if exists auth_user_created on auth.users;
create trigger auth_user_created after insert on auth.users
for each row execute function public.on_auth_user_created();

-- ────────────────────────────────────────────── 2. 개념별·방식별 복습 상태
-- 같은 개념을 4지선다·빈칸·직접회상으로 따로 관리한다.
-- 하나를 맞혔다고 다른 방식까지 외운 것으로 처리하지 않는다.
create table if not exists public.study_progress (
  user_id    uuid not null references auth.users(id) on delete cascade,
  atom_id    text not null check (char_length(atom_id) between 1 and 20),
  mode       text not null check (mode in ('quiz','blank','recall')),
  streak     smallint not null default 0 check (streak between 0 and 20),  -- 연속 정답 단계
  due_day    integer not null,                                             -- 복습 예정일(1970-01-01부터의 일수)
  last_ok    boolean,
  n_try      integer not null default 0,
  n_ok       integer not null default 0,
  subject    text,
  major      text,
  updated_at timestamptz not null default now(),
  primary key (user_id, atom_id, mode)
);
create index if not exists study_progress_due_idx on public.study_progress (user_id, due_day);
create index if not exists study_progress_subject_idx on public.study_progress (user_id, subject);

-- ────────────────────────────────────────────── 3. 문항별 응답 기록
-- 무엇을 어떻게 틀렸는지 남긴다. 덮어쓰지 않고 쌓는다.
create table if not exists public.quiz_attempts (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  item_id     text check (char_length(item_id) <= 24),
  atom_id     text check (char_length(atom_id) <= 20),
  mode        text not null check (mode in ('quiz','blank','recall')),
  kind        text check (kind in ('num','art')),
  subject     text,
  major       text,
  correct     boolean not null,
  chosen      smallint,
  elapsed_ms  integer,
  answered_at timestamptz not null default now()
);
create index if not exists quiz_attempts_user_idx on public.quiz_attempts (user_id, answered_at desc);
create index if not exists quiz_attempts_wrong_idx on public.quiz_attempts (user_id, subject, correct);

-- ────────────────────────────────────────────── 4. 모의시험 결과
create table if not exists public.mock_results (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('real','subject','practice')),
  n_item      smallint not null,
  n_correct   smallint not null,
  total_score smallint not null,
  by_subject  jsonb not null default '{}'::jsonb,   -- {"공공계약관리": {"n":30,"ok":19,"score":63}}
  passed      boolean,                              -- 과목 40점·평균 60점 기준 충족 여부
  timed       boolean not null default true,
  elapsed_sec integer,
  wrong_atoms text[] not null default '{}'::text[],
  taken_at    timestamptz not null default now()
);
create index if not exists mock_results_user_idx on public.mock_results (user_id, taken_at desc);

-- ────────────────────────────────────────────── 5. 학습계획 체크
create table if not exists public.plan_checks (
  user_id    uuid not null references auth.users(id) on delete cascade,
  day        smallint not null check (day between 1 and 21),
  round      smallint not null check (round between 1 and 3),
  checked_at timestamptz not null default now(),
  primary key (user_id, day, round)
);

-- ────────────────────────────────────────────── 6. 성취도 요약
-- 화면에서 바로 읽을 수 있게 과목별로 집계한다. 본인 것만 나온다.
create or replace view public.my_progress_summary as
select
  p.user_id,
  p.subject,
  count(distinct p.atom_id)                                   as atoms_touched,
  count(*)                                                    as rows_all,
  count(*) filter (where p.streak >= 1)                       as rows_ok_once,
  count(*) filter (where p.streak >= 3)                       as rows_solid,
  count(*) filter (where p.due_day <= floor(extract(epoch from now()) / 86400)) as rows_due,
  sum(p.n_try)                                                as tries,
  sum(p.n_ok)                                                 as hits
from public.study_progress p
where p.user_id = auth.uid()
group by p.user_id, p.subject;

-- 취약 주요항목. 최근 응답에서 오답률이 높은 순서.
create or replace view public.my_weak_majors as
select
  a.user_id, a.subject, a.major,
  count(*)                                   as n,
  count(*) filter (where not a.correct)      as wrong,
  round(100.0 * count(*) filter (where not a.correct) / count(*), 1) as wrong_pct
from public.quiz_attempts a
where a.user_id = auth.uid()
group by a.user_id, a.subject, a.major
having count(*) >= 3
order by wrong_pct desc, n desc;

-- ────────────────────────────────────────────── 7. 비회원 진도 이관
-- 로그인하기 전 브라우저에 쌓인 기록을 한 번에 올린다. 이미 있는 개념은 더 앞선 상태를 남긴다.
create or replace function public.merge_progress(rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer := 0;
begin
  if auth.uid() is null then
    raise exception 'login required';
  end if;
  insert into public.study_progress
    (user_id, atom_id, mode, streak, due_day, last_ok, n_try, n_ok, subject, major)
  select
    auth.uid(),
    r->>'atom_id',
    r->>'mode',
    coalesce((r->>'streak')::smallint, 0),
    coalesce((r->>'due_day')::integer, 0),
    (r->>'last_ok')::boolean,
    coalesce((r->>'n_try')::integer, 0),
    coalesce((r->>'n_ok')::integer, 0),
    r->>'subject',
    r->>'major'
  from jsonb_array_elements(rows) as r
  where r->>'atom_id' is not null
    and r->>'mode' in ('quiz','blank','recall')
  on conflict (user_id, atom_id, mode) do update
    set streak  = greatest(study_progress.streak, excluded.streak),
        due_day = greatest(study_progress.due_day, excluded.due_day),
        n_try   = study_progress.n_try + excluded.n_try,
        n_ok    = study_progress.n_ok + excluded.n_ok,
        updated_at = now();
  get diagnostics n = row_count;
  return n;
end;
$$;

-- ────────────────────────────────────────────── 8. RLS — 본인 것만
alter table public.profiles        enable row level security;
alter table public.study_progress  enable row level security;
alter table public.quiz_attempts   enable row level security;
alter table public.mock_results    enable row level security;
alter table public.plan_checks     enable row level security;

do $$
declare t text;
begin
  foreach t in array array['profiles','study_progress','quiz_attempts','mock_results','plan_checks']
  loop
    execute format('drop policy if exists "%s own select" on public.%I', t, t);
    execute format('drop policy if exists "%s own insert" on public.%I', t, t);
    execute format('drop policy if exists "%s own update" on public.%I', t, t);
    execute format('drop policy if exists "%s own delete" on public.%I', t, t);
    execute format('create policy "%s own select" on public.%I for select using (auth.uid() = user_id)', t, t);
    execute format('create policy "%s own insert" on public.%I for insert with check (auth.uid() = user_id)', t, t);
    execute format('create policy "%s own update" on public.%I for update using (auth.uid() = user_id)', t, t);
    execute format('create policy "%s own delete" on public.%I for delete using (auth.uid() = user_id)', t, t);
  end loop;
end $$;

-- 닉네임은 게시판에서 남이 볼 수 있어야 하므로 읽기만 따로 연다.
drop policy if exists "nickname readable" on public.profiles;
create policy "nickname readable" on public.profiles for select using (true);

-- ────────────────────────────────────────────── 9. 권한
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles       to authenticated;
grant select, insert, update, delete on public.study_progress to authenticated;
grant select, insert                 on public.quiz_attempts  to authenticated;
grant select, insert                 on public.mock_results   to authenticated;
grant select, insert, delete         on public.plan_checks    to authenticated;
grant select on public.my_progress_summary to authenticated;
grant select on public.my_weak_majors      to authenticated;
grant select on public.profiles            to anon;
grant usage, select on all sequences in schema public to authenticated;
grant execute on function public.merge_progress(jsonb) to authenticated;

notify pgrst, 'reload schema';
select 'jodal_pro_auth_progress_ready' as status;
