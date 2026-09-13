-- jodal.pro 커뮤니티 스키마
-- Supabase SQL Editor에 전체를 붙여 넣고 Run 한 번으로 끝납니다. 여러 번 실행해도 안전합니다.
-- 비로그인 방문자도 글을 쓸 수 있게 하되, 후기에는 판단에 필요한 정보를 반드시 받습니다.

create extension if not exists pgcrypto;

-- ────────────────────────────────────────────── 1. 자유게시판
create table if not exists public.board_posts (
  id           bigserial primary key,
  kind         text not null default 'free'
               check (kind in ('free','qna','exam','job','notice')),
  title        text not null check (char_length(title) between 2 and 120),
  body         text not null check (char_length(body) between 2 and 20000),
  author_name  text not null default '익명' check (char_length(author_name) between 1 and 24),
  user_id      uuid references auth.users(id) on delete set null,
  pinned       boolean not null default false,
  views        integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists board_posts_kind_idx on public.board_posts (kind, created_at desc);

-- ────────────────────────────────────────────── 2. 댓글
create table if not exists public.board_comments (
  id           bigserial primary key,
  post_id      bigint not null references public.board_posts(id) on delete cascade,
  body         text not null check (char_length(body) between 1 and 4000),
  author_name  text not null default '익명' check (char_length(author_name) between 1 and 24),
  user_id      uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists board_comments_post_idx on public.board_comments (post_id, created_at);

-- ────────────────────────────────────────────── 3. 자료 후기
-- 이용기간·실제 이용범위·입수경로·이해관계는 비워 둘 수 없다.
-- 한 사람의 5점과 여러 사람의 평균을 같은 확실성으로 취급하지 않기 위해 표본 정보를 함께 보관한다.
create table if not exists public.material_reviews (
  id            bigserial primary key,
  material_name text not null check (char_length(material_name) between 2 and 120),
  material_kind text not null
                check (material_kind in ('교재','인터넷강의','학원강좌','무료자료','문제집','기타')),
  edition       text,
  rating        smallint not null check (rating between 1 and 5),
  used_period   text not null check (char_length(used_period) between 1 and 60),
  used_scope    text not null check (char_length(used_scope) between 1 and 200),
  acquired      text not null check (acquired in ('직접구매','무료이용','제공받음')),
  conflict      text not null default '없음' check (char_length(conflict) between 1 and 200),
  pros          text check (char_length(pros) <= 2000),
  cons          text check (char_length(cons) <= 2000),
  fit_for       text check (char_length(fit_for) <= 500),
  author_name   text not null default '익명' check (char_length(author_name) between 1 and 24),
  user_id       uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists material_reviews_name_idx on public.material_reviews (material_name, created_at desc);

-- 자료별 집계. 후기가 없는 자료는 이 뷰에 나오지 않는다(별 0점으로 바꾸지 않기 위해).
create or replace view public.material_review_stats as
select
  material_name,
  material_kind,
  count(*)                                        as n,
  round(avg(rating)::numeric, 2)                  as avg_rating,
  count(*) filter (where acquired = '제공받음')   as n_provided,
  count(*) filter (where conflict <> '없음')      as n_conflict,
  max(created_at)                                 as last_at
from public.material_reviews
group by material_name, material_kind;

-- ────────────────────────────────────────────── 4. 오류 신고
-- 별점과 분리한다. 법령의 정확성은 인기투표로 판단하지 않는다.
create table if not exists public.problem_reports (
  id           bigserial primary key,
  page_url     text not null check (char_length(page_url) between 3 and 500),
  quote        text not null check (char_length(quote) between 2 and 2000),   -- 틀린 문장
  correction   text check (char_length(correction) <= 2000),                  -- 맞는 내용
  evidence     text check (char_length(evidence) <= 1000),                    -- 근거 조문·공고·교재 쪽
  atom_id      text check (char_length(atom_id) <= 20),
  detail       text check (char_length(detail) <= 4000),
  author_name  text not null default '익명' check (char_length(author_name) between 1 and 24),
  user_id      uuid references auth.users(id) on delete set null,
  status       text not null default 'open' check (status in ('open','checking','fixed','rejected')),
  admin_note   text,
  created_at   timestamptz not null default now()
);
create index if not exists problem_reports_status_idx on public.problem_reports (status, created_at desc);

-- ────────────────────────────────────────────── 5. 조회수 증가 (한 건씩만)
create or replace function public.bump_post_views(p_id bigint)
returns void
language sql
security definer
set search_path = public
as $$
  update public.board_posts set views = views + 1 where id = p_id;
$$;

-- ────────────────────────────────────────────── 6. 수정시각 자동 갱신
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists board_posts_touch on public.board_posts;
create trigger board_posts_touch before update on public.board_posts
for each row execute function public.touch_updated_at();

-- ────────────────────────────────────────────── 7. RLS
-- 읽기는 전체 공개. 쓰기는 비로그인도 허용(작성자 표시는 '익명').
-- 고치고 지우는 것은 로그인한 본인만. 비로그인 글은 운영자가 service_role로 처리한다.
alter table public.board_posts      enable row level security;
alter table public.board_comments   enable row level security;
alter table public.material_reviews enable row level security;
alter table public.problem_reports  enable row level security;

drop policy if exists "posts readable"        on public.board_posts;
drop policy if exists "posts insert"          on public.board_posts;
drop policy if exists "posts owner update"    on public.board_posts;
drop policy if exists "posts owner delete"    on public.board_posts;
create policy "posts readable"     on public.board_posts for select using (true);
create policy "posts insert"       on public.board_posts for insert
  with check (user_id is null or auth.uid() = user_id);
create policy "posts owner update" on public.board_posts for update
  using (user_id is not null and auth.uid() = user_id);
create policy "posts owner delete" on public.board_posts for delete
  using (user_id is not null and auth.uid() = user_id);

drop policy if exists "comments readable"     on public.board_comments;
drop policy if exists "comments insert"       on public.board_comments;
drop policy if exists "comments owner delete" on public.board_comments;
create policy "comments readable"     on public.board_comments for select using (true);
create policy "comments insert"       on public.board_comments for insert
  with check (user_id is null or auth.uid() = user_id);
create policy "comments owner delete" on public.board_comments for delete
  using (user_id is not null and auth.uid() = user_id);

drop policy if exists "reviews readable" on public.material_reviews;
drop policy if exists "reviews insert"   on public.material_reviews;
create policy "reviews readable" on public.material_reviews for select using (true);
create policy "reviews insert"   on public.material_reviews for insert
  with check (user_id is null or auth.uid() = user_id);

-- 오류 신고는 접수만 공개한다. 남의 신고 내용은 읽히지 않게 한다.
drop policy if exists "reports insert" on public.problem_reports;
drop policy if exists "reports own"    on public.problem_reports;
create policy "reports insert" on public.problem_reports for insert
  with check (user_id is null or auth.uid() = user_id);
create policy "reports own"    on public.problem_reports for select
  using (user_id is not null and auth.uid() = user_id);

-- ────────────────────────────────────────────── 8. 권한
grant usage on schema public to anon, authenticated;
grant select, insert on public.board_posts      to anon, authenticated;
grant select, insert on public.board_comments   to anon, authenticated;
grant select, insert on public.material_reviews to anon, authenticated;
grant insert         on public.problem_reports  to anon, authenticated;
grant select         on public.material_review_stats to anon, authenticated;
grant update (title, body) on public.board_posts to authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
alter default privileges in schema public grant usage, select on sequences to anon, authenticated;
grant execute on function public.bump_post_views(bigint) to anon, authenticated;

notify pgrst, 'reload schema';
select 'jodal_pro_schema_ready' as status;
