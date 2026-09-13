-- jodal.pro 접속 기기 기록
-- auth_progress.sql 다음에 실행한다. 여러 번 실행해도 안전하다.
--
-- 할 수 있는 것 : 우리가 브라우저에 심은 임의의 기기 ID로 같은 기기를 알아본다.
--                 브라우저·운영체제·모바일 여부·화면·언어·시간대는 브라우저가 알려주는 값을 받는다.
-- 못 하는 것   : 기기의 진짜 고유번호는 알 수 없다. 브라우저 저장소를 지우거나
--                 시크릿 창으로 오면 새 기기로 잡힌다. 지문채취(fingerprinting)는 쓰지 않는다.
-- 읽기 권한   : 비회원·회원 누구도 이 표를 읽지 못한다. 운영자만 대시보드에서 본다.

create table if not exists public.device_sessions (
  device_id   uuid primary key,
  user_id     uuid references auth.users(id) on delete set null,
  ua          text check (char_length(ua) <= 500),
  browser     text check (char_length(browser) <= 40),
  os          text check (char_length(os) <= 40),
  is_mobile   boolean,
  screen      text check (char_length(screen) <= 20),
  lang        text check (char_length(lang) <= 20),
  tz          text check (char_length(tz) <= 60),
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now(),
  n_visits    integer not null default 1
);
create index if not exists device_sessions_user_idx on public.device_sessions (user_id, last_seen desc);
create index if not exists device_sessions_seen_idx on public.device_sessions (last_seen desc);

-- 남길 값이 있는 사건만 쌓는다. 모든 페이지 이동을 남기면 무료 용량이 금방 찬다.
create table if not exists public.device_events (
  id        bigserial primary key,
  device_id uuid not null,
  user_id   uuid references auth.users(id) on delete set null,
  kind      text not null check (kind in ('first_visit','login','logout','mock_submit','drill_done','review_post','progress_merge')),
  detail    jsonb not null default '{}'::jsonb,
  at        timestamptz not null default now()
);
create index if not exists device_events_device_idx on public.device_events (device_id, at desc);
create index if not exists device_events_kind_idx on public.device_events (kind, at desc);

-- ────────────────────────────────────────────── 기록 함수
-- 표에 직접 쓰게 하지 않는다. 남의 기기 줄을 고치지 못하도록 함수만 열어 둔다.
create or replace function public.touch_device(
  p_device_id uuid,
  p_meta      jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.device_sessions
    (device_id, user_id, ua, browser, os, is_mobile, screen, lang, tz)
  values (
    p_device_id,
    auth.uid(),
    left(p_meta->>'ua', 500),
    left(p_meta->>'browser', 40),
    left(p_meta->>'os', 40),
    (p_meta->>'is_mobile')::boolean,
    left(p_meta->>'screen', 20),
    left(p_meta->>'lang', 20),
    left(p_meta->>'tz', 60)
  )
  on conflict (device_id) do update
    set last_seen = now(),
        n_visits  = device_sessions.n_visits + 1,
        user_id   = coalesce(auth.uid(), device_sessions.user_id),
        ua        = coalesce(left(p_meta->>'ua', 500), device_sessions.ua),
        browser   = coalesce(left(p_meta->>'browser', 40), device_sessions.browser),
        os        = coalesce(left(p_meta->>'os', 40), device_sessions.os),
        is_mobile = coalesce((p_meta->>'is_mobile')::boolean, device_sessions.is_mobile),
        screen    = coalesce(left(p_meta->>'screen', 20), device_sessions.screen),
        lang      = coalesce(left(p_meta->>'lang', 20), device_sessions.lang),
        tz        = coalesce(left(p_meta->>'tz', 60), device_sessions.tz);
end;
$$;

create or replace function public.log_device_event(
  p_device_id uuid,
  p_kind      text,
  p_detail    jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.device_events (device_id, user_id, kind, detail)
  values (p_device_id, auth.uid(), p_kind, coalesce(p_detail, '{}'::jsonb));
end;
$$;

-- 회원이 자기 기기 목록을 볼 수 있게 한다. 남의 기기는 나오지 않는다.
create or replace view public.my_devices as
select device_id, browser, os, is_mobile, screen, tz, first_seen, last_seen, n_visits
from public.device_sessions
where user_id is not null and user_id = auth.uid();

-- ────────────────────────────────────────────── RLS
alter table public.device_sessions enable row level security;
alter table public.device_events   enable row level security;
-- 정책을 하나도 만들지 않는다 = anon·authenticated는 직접 읽고 쓸 수 없다.
-- 기록은 위의 security definer 함수로만, 조회는 운영자(service_role)와 my_devices 뷰로만.

revoke all on public.device_sessions from anon, authenticated;
revoke all on public.device_events   from anon, authenticated;
grant select, insert, update, delete on public.device_sessions to service_role;
grant select, insert, update, delete on public.device_events   to service_role;
grant select on public.my_devices to authenticated;
grant execute on function public.touch_device(uuid, jsonb)            to anon, authenticated;
grant execute on function public.log_device_event(uuid, text, jsonb)  to anon, authenticated;

notify pgrst, 'reload schema';
select 'jodal_pro_device_log_ready' as status;
