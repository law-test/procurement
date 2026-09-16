-- jodal.pro 방문 집계
-- device_log.sql 다음에 실행한다. 여러 번 실행해도 안전하다.
--
-- 할 수 있는 것 : 날짜별 순 방문 브라우저 수, 화면별 열어 본 횟수.
-- 못 하는 것   : 사람을 특정하는 것. 이름·연락처·IP를 받지 않는다.
--                 브라우저 특성을 조합해 사람을 알아내는 방식(지문채취)은 쓰지 않는다.
--                 같은 브라우저를 알아보는 근거는 우리가 심은 무작위 UUID 하나뿐이고,
--                 저장소를 지우거나 시크릿 창으로 오면 새 방문자로 잡힌다.
-- 공개 범위   : 아래 세 뷰(합계 수치)만 누구나 읽는다. 원본 표는 직접 읽지 못한다.

create table if not exists public.visit_days (
  day       date not null,
  device_id uuid not null,
  primary key (day, device_id)
);
create index if not exists visit_days_day_idx on public.visit_days (day desc);

create table if not exists public.page_hits (
  day  date    not null,
  path text    not null check (char_length(path) <= 200),
  hits integer not null default 0,
  primary key (day, path)
);
create index if not exists page_hits_day_idx on public.page_hits (day desc);

-- ────────────────────────────────────────────── 기록 함수
-- 표를 직접 열지 않는다. 함수 하나만 열어 둔다. 한 화면당 한 번 호출한다.
create or replace function public.record_visit(
  p_device_id     uuid,
  p_path          text,
  p_meta          jsonb   default '{}'::jsonb,
  p_session_start boolean default false
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day  date := (now() at time zone 'Asia/Seoul')::date;
  v_path text := left(coalesce(nullif(btrim(p_path), ''), '/'), 200);
begin
  -- 브라우저를 처음 열었을 때만 기기 줄을 갱신한다(방문 횟수가 화면 수만큼 늘지 않게).
  if p_session_start then
    perform public.touch_device(p_device_id, coalesce(p_meta, '{}'::jsonb));
  end if;

  insert into public.visit_days (day, device_id)
  values (v_day, p_device_id)
  on conflict (day, device_id) do nothing;

  insert into public.page_hits (day, path, hits)
  values (v_day, v_path, 1)
  on conflict (day, path) do update
    set hits = page_hits.hits + 1;
end;
$$;

-- ────────────────────────────────────────────── 공개 집계 뷰 (합계만)
create or replace view public.visit_stats as
select
  (select count(distinct device_id) from public.visit_days
     where day = (now() at time zone 'Asia/Seoul')::date)::int          as today,
  (select count(distinct device_id) from public.visit_days
     where day = (now() at time zone 'Asia/Seoul')::date - 1)::int      as yesterday,
  (select count(distinct device_id) from public.visit_days
     where day >= (now() at time zone 'Asia/Seoul')::date - 6)::int     as last7,
  (select count(distinct device_id) from public.visit_days
     where day >= (now() at time zone 'Asia/Seoul')::date - 29)::int    as last30,
  (select count(distinct device_id) from public.visit_days)::int        as total_visitors,
  (select coalesce(sum(hits), 0) from public.page_hits
     where day = (now() at time zone 'Asia/Seoul')::date)::int          as today_hits,
  (select coalesce(sum(hits), 0) from public.page_hits)::int            as total_hits,
  (select min(day) from public.visit_days)                              as since;

create or replace view public.visit_daily as
select day, count(distinct device_id)::int as visitors
from public.visit_days
where day >= (now() at time zone 'Asia/Seoul')::date - 29
group by day
order by day desc;

create or replace view public.visit_pages as
select path, sum(hits)::int as hits
from public.page_hits
where day >= (now() at time zone 'Asia/Seoul')::date - 6
group by path
order by sum(hits) desc
limit 40;

-- ────────────────────────────────────────────── 권한
alter table public.visit_days enable row level security;
alter table public.page_hits  enable row level security;
-- 정책을 하나도 만들지 않는다 = anon·authenticated는 표를 직접 읽고 쓸 수 없다.

revoke all on public.visit_days from anon, authenticated;
revoke all on public.page_hits  from anon, authenticated;
grant select, insert, update, delete on public.visit_days to service_role;
grant select, insert, update, delete on public.page_hits  to service_role;

grant select on public.visit_stats to anon, authenticated;
grant select on public.visit_daily to anon, authenticated;
grant select on public.visit_pages to anon, authenticated;
grant execute on function public.record_visit(uuid, text, jsonb, boolean) to anon, authenticated;

notify pgrst, 'reload schema';
select 'jodal_pro_visits_ready' as status;
