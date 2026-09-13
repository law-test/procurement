-- 소셜 계정 연결표
-- 네이버처럼 이메일을 안 줄 수도 있는 제공자를 위해, 제공자가 준 고유 ID로 계정을 찾는다.
-- 이메일이 바뀌어도 같은 사람으로 이어진다. 구글·카카오도 같은 표를 쓸 수 있다.
-- device_log.sql 다음에 실행한다. 여러 번 실행해도 안전하다.

create table if not exists public.social_links (
  provider     text not null check (provider in ('naver','kakao','google','apple')),
  provider_uid text not null check (char_length(provider_uid) between 1 and 128),
  user_id      uuid not null references auth.users(id) on delete cascade,
  linked_at    timestamptz not null default now(),
  primary key (provider, provider_uid)
);
create index if not exists social_links_user_idx on public.social_links (user_id);

-- 본인이 무엇으로 로그인했는지 볼 수 있게 한다. 남의 연결은 나오지 않는다.
create or replace view public.my_social_links as
select provider, linked_at
from public.social_links
where user_id = auth.uid();

alter table public.social_links enable row level security;
-- 정책을 두지 않는다 = anon·authenticated는 직접 읽고 쓸 수 없다.
-- 쓰기는 Edge Function(service_role)만, 조회는 my_social_links 뷰로만.

revoke all on public.social_links from anon, authenticated;
grant select, insert, update, delete on public.social_links to service_role;
grant select on public.my_social_links to authenticated;

notify pgrst, 'reload schema';
select 'jodal_pro_social_naver_ready' as status;
