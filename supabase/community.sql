-- Jodal public community. Run after ranking.sql in the same Supabase project.
-- A post/review is explicitly public even when its author's ranking is private.
-- Dedicated jp_comm_* tables only; existing sites' tables are never changed.
-- Deleting a ranking identity also deletes that identity's posts and reviews.
BEGIN;
CREATE TABLE IF NOT EXISTS public.jp_comm_posts (
  id uuid PRIMARY KEY,
  player_id uuid NOT NULL REFERENCES public.jp_rank_profiles(player_id) ON DELETE CASCADE,
  kind text NOT NULL CHECK(kind IN ('free','news')),
  title text NOT NULL CHECK(char_length(title) BETWEEN 1 AND 100 AND title ~ '[^[:space:]]'),
  body text NOT NULL CHECK(char_length(body) BETWEEN 1 AND 5000 AND body ~ '[^[:space:]]'),
  source_url text NOT NULL DEFAULT '',
  source_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS public.jp_comm_reviews (
  id uuid PRIMARY KEY,
  player_id uuid NOT NULL REFERENCES public.jp_rank_profiles(player_id) ON DELETE CASCADE,
  service text NOT NULL CHECK(service ~ '^[a-z0-9][a-z0-9_-]{1,79}$'),
  rating integer NOT NULL CHECK(rating BETWEEN 1 AND 5),
  period text NOT NULL CHECK(char_length(period) BETWEEN 2 AND 80),
  scope text NOT NULL CHECK(char_length(scope) BETWEEN 2 AND 200),
  acquired text NOT NULL CHECK(acquired IN ('direct','free','provided')),
  conflict text NOT NULL CHECK(char_length(conflict) BETWEEN 2 AND 200),
  pros text NOT NULL CHECK(char_length(pros) BETWEEN 5 AND 2000),
  cons text NOT NULL CHECK(char_length(cons) BETWEEN 5 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted boolean NOT NULL DEFAULT false,
  UNIQUE(player_id,service)
);
CREATE TABLE IF NOT EXISTS public.jp_comm_comments (
  id uuid PRIMARY KEY,
  post_id uuid NOT NULL REFERENCES public.jp_comm_posts(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.jp_rank_profiles(player_id) ON DELETE CASCADE,
  body text NOT NULL CHECK(char_length(body) BETWEEN 1 AND 2000 AND body ~ '[^[:space:]]'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS jp_comm_posts_feed ON public.jp_comm_posts(kind,created_at DESC) WHERE NOT deleted;
CREATE INDEX IF NOT EXISTS jp_comm_posts_author ON public.jp_comm_posts(player_id,created_at);
CREATE INDEX IF NOT EXISTS jp_comm_reviews_feed ON public.jp_comm_reviews(service,created_at DESC) WHERE NOT deleted;
CREATE INDEX IF NOT EXISTS jp_comm_comments_feed ON public.jp_comm_comments(post_id,created_at DESC) WHERE NOT deleted;
CREATE INDEX IF NOT EXISTS jp_comm_comments_author ON public.jp_comm_comments(player_id,created_at);
ALTER TABLE public.jp_comm_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jp_comm_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jp_comm_comments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.jp_comm_posts,public.jp_comm_reviews,public.jp_comm_comments FROM PUBLIC,anon,authenticated;

-- Canonical catalog IDs, not arbitrary external service claims.
CREATE OR REPLACE FUNCTION public.jp_comm_service_valid(p_service text)
RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
  SELECT coalesce(p_service IN ('book-01','book-02','book-03','book-04','book-05','book-06','book-07','book-08',
    'lecture-01','lecture-02','lecture-03','lecture-04','lecture-05',
    'official-textbook','official-elearning','jodalmaster','jodal-pro'),false);
$$;

CREATE OR REPLACE FUNCTION public.jp_comm_post_json(p_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
  SELECT jsonb_build_object('id',p.id,'kind',p.kind,'title',p.title,'body',p.body,'sourceUrl',p.source_url,
    'sourceName',p.source_name,'nickname',a.nickname,'profileId',a.profile_id,
    'createdAt',p.created_at,'updatedAt',p.updated_at)
  FROM public.jp_comm_posts p JOIN public.jp_rank_profiles a USING(player_id)
  WHERE p.id=p_id AND NOT p.deleted;
$$;
CREATE OR REPLACE FUNCTION public.jp_comm_review_json(p_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
  SELECT jsonb_build_object('id',r.id,'service',r.service,'rating',r.rating,'period',r.period,'scope',r.scope,
    'acquired',r.acquired,'conflict',r.conflict,'pros',r.pros,'cons',r.cons,
    'nickname',a.nickname,'profileId',a.profile_id,'createdAt',r.created_at,'updatedAt',r.updated_at)
  FROM public.jp_comm_reviews r JOIN public.jp_rank_profiles a USING(player_id)
  WHERE r.id=p_id AND NOT r.deleted;
$$;
CREATE OR REPLACE FUNCTION public.jp_comm_list(p_kind text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE result jsonb;
BEGIN
  IF p_kind IS NULL OR p_kind NOT IN ('free','news') THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='게시판을 확인해 주세요.'; END IF;
  SELECT coalesce(jsonb_agg(public.jp_comm_post_json(p.id) ORDER BY p.created_at DESC,p.id),'[]'::jsonb) INTO result
    FROM (SELECT id,created_at FROM public.jp_comm_posts WHERE kind=p_kind AND NOT deleted ORDER BY created_at DESC,id LIMIT 50) p;
  RETURN result;
END;
$$;
CREATE OR REPLACE FUNCTION public.jp_comm_get(p_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
  SELECT public.jp_comm_post_json(p_id);
$$;
CREATE OR REPLACE FUNCTION public.jp_comm_post(p_player uuid,p_secret text,p_id uuid,p_kind text,p_title text,p_body text,p_source_url text DEFAULT '',p_source_name text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE previous public.jp_comm_posts;
BEGIN
  PERFORM public.jp_rank_auth(p_player,p_secret);
  PERFORM 1 FROM public.jp_rank_profiles WHERE player_id=p_player FOR UPDATE;
  p_title:=regexp_replace(p_title,'^[[:space:]]+|[[:space:]]+$','','g');p_body:=regexp_replace(p_body,'^[[:space:]]+|[[:space:]]+$','','g');p_source_url:=btrim(coalesce(p_source_url,''));p_source_name:=btrim(coalesce(p_source_name,''));
  IF p_id IS NULL OR p_kind IS NULL OR p_kind NOT IN ('free','news') OR p_title IS NULL OR char_length(p_title) NOT BETWEEN 1 AND 100
    OR p_body IS NULL OR char_length(p_body) NOT BETWEEN 1 AND 5000 THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='제목과 내용을 입력해 주세요. 제목은 100자, 본문은 5000자까지 쓸 수 있습니다.';
  END IF;
  IF char_length(p_source_name)>120 OR char_length(p_source_url)>2000 OR
    (p_source_url<>'' AND p_source_url !~ '^https://[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?(:[0-9]{1,5})?([/?#][^[:space:]<>"\\]*)?$') THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='출처는 올바른 HTTPS 원문 주소로 입력해 주세요.';
  END IF;
  IF p_kind='news' AND (p_source_url='' OR char_length(p_source_name)<2) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='소식에는 원문 주소와 출처 기관·매체명을 함께 적어 주세요.';
  END IF;
  SELECT * INTO previous FROM public.jp_comm_posts WHERE id=p_id;
  IF FOUND THEN
    IF previous.player_id<>p_player OR previous.kind<>p_kind THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='이 글을 수정할 수 없습니다.'; END IF;
    UPDATE public.jp_comm_posts SET title=p_title,body=p_body,source_url=p_source_url,source_name=p_source_name,updated_at=now(),deleted=false WHERE id=p_id;
  ELSE
    IF (SELECT count(*) FROM public.jp_comm_posts WHERE player_id=p_player AND created_at >= ((now() AT TIME ZONE 'Asia/Seoul')::date::timestamp AT TIME ZONE 'Asia/Seoul'))>=10 THEN
      RAISE EXCEPTION USING ERRCODE='54000',MESSAGE='글은 하루 10개까지 작성할 수 있습니다.';
    END IF;
    INSERT INTO public.jp_comm_posts(id,player_id,kind,title,body,source_url,source_name)
    VALUES(p_id,p_player,p_kind,p_title,p_body,p_source_url,p_source_name);
  END IF;
  RETURN public.jp_comm_post_json(p_id);
END;
$$;
CREATE OR REPLACE FUNCTION public.jp_comm_review(p_player uuid,p_secret text,p_id uuid,p_service text,p_rating integer,p_period text,p_scope text,p_acquired text,p_conflict text,p_pros text,p_cons text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE previous public.jp_comm_reviews; actual_id uuid;
BEGIN
  PERFORM public.jp_rank_auth(p_player,p_secret);
  PERFORM 1 FROM public.jp_rank_profiles WHERE player_id=p_player FOR UPDATE;
  p_period:=btrim(p_period);p_scope:=btrim(p_scope);p_conflict:=btrim(p_conflict);p_pros:=btrim(p_pros);p_cons:=btrim(p_cons);
  IF p_id IS NULL OR NOT public.jp_comm_service_valid(p_service)
    OR p_rating IS NULL OR p_rating NOT BETWEEN 1 AND 5 OR p_acquired IS NULL OR p_acquired NOT IN ('direct','free','provided') THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='서비스·별점·이용 경로를 확인해 주세요.';
  END IF;
  IF p_period IS NULL OR char_length(p_period) NOT BETWEEN 2 AND 80 OR p_scope IS NULL OR char_length(p_scope) NOT BETWEEN 2 AND 200
    OR p_conflict IS NULL OR char_length(p_conflict) NOT BETWEEN 2 AND 200 OR p_pros IS NULL OR char_length(p_pros) NOT BETWEEN 5 AND 2000
    OR p_cons IS NULL OR char_length(p_cons) NOT BETWEEN 5 AND 2000 THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='이용 기간·범위·이해관계와 좋았던 점·아쉬운 점을 구체적으로 적어 주세요.';
  END IF;
  SELECT * INTO previous FROM public.jp_comm_reviews WHERE id=p_id;
  IF FOUND AND (previous.player_id<>p_player OR previous.service<>p_service) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='이 후기를 수정할 수 없습니다.';
  END IF;
  SELECT id INTO actual_id FROM public.jp_comm_reviews WHERE player_id=p_player AND service=p_service;
  IF actual_id IS NULL THEN
    IF (SELECT count(*) FROM public.jp_comm_reviews WHERE player_id=p_player AND created_at >= ((now() AT TIME ZONE 'Asia/Seoul')::date::timestamp AT TIME ZONE 'Asia/Seoul'))>=10 THEN
      RAISE EXCEPTION USING ERRCODE='54000',MESSAGE='새 후기는 하루 10개까지 작성할 수 있습니다.';
    END IF;
    actual_id:=p_id;
    INSERT INTO public.jp_comm_reviews(id,player_id,service,rating,period,scope,acquired,conflict,pros,cons)
    VALUES(actual_id,p_player,p_service,p_rating,p_period,p_scope,p_acquired,p_conflict,p_pros,p_cons);
  ELSE
    UPDATE public.jp_comm_reviews SET rating=p_rating,period=p_period,scope=p_scope,acquired=p_acquired,conflict=p_conflict,
      pros=p_pros,cons=p_cons,updated_at=now(),deleted=false WHERE id=actual_id;
  END IF;
  RETURN public.jp_comm_review_json(actual_id);
END;
$$;
CREATE OR REPLACE FUNCTION public.jp_comm_reviews(p_service text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE result jsonb;
BEGIN
  IF p_service IS NOT NULL AND NOT public.jp_comm_service_valid(p_service) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='서비스를 확인해 주세요.'; END IF;
  WITH active AS (SELECT * FROM public.jp_comm_reviews WHERE NOT deleted AND (p_service IS NULL OR service=p_service)),
    totals AS (SELECT service,count(*) n,round(avg(rating),1) average,count(*) FILTER(WHERE acquired='provided') provided_count FROM active GROUP BY service)
  SELECT jsonb_build_object('rows',coalesce((SELECT jsonb_agg(public.jp_comm_review_json(r.id) ORDER BY r.created_at DESC,r.id)
    FROM (SELECT id,created_at FROM active ORDER BY created_at DESC,id LIMIT 100) r),'[]'::jsonb),
    'stats',coalesce((SELECT jsonb_agg(jsonb_build_object('service',service,'n',n,'average',average,'providedCount',provided_count) ORDER BY service) FROM totals),'[]'::jsonb)) INTO result;
  RETURN result;
END;
$$;
CREATE OR REPLACE FUNCTION public.jp_comm_comments(p_post uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',r.id,'postId',r.post_id,'body',r.body,
    'nickname',a.nickname,'profileId',a.profile_id,'createdAt',r.created_at,'updatedAt',r.updated_at)
    ORDER BY r.created_at,r.id),'[]'::jsonb)
  FROM (SELECT c.* FROM public.jp_comm_comments c JOIN public.jp_comm_posts p ON p.id=c.post_id
    WHERE c.post_id=p_post AND NOT c.deleted AND NOT p.deleted ORDER BY c.created_at DESC,c.id DESC LIMIT 100) r
  JOIN public.jp_rank_profiles a USING(player_id);
$$;
CREATE OR REPLACE FUNCTION public.jp_comm_comment(p_player uuid,p_secret text,p_id uuid,p_post uuid,p_body text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE previous public.jp_comm_comments; saved public.jp_comm_comments; author public.jp_rank_profiles;
BEGIN
  PERFORM public.jp_rank_auth(p_player,p_secret);
  SELECT * INTO author FROM public.jp_rank_profiles WHERE player_id=p_player FOR UPDATE;
  p_body:=regexp_replace(p_body,'^[[:space:]]+|[[:space:]]+$','','g');
  IF p_id IS NULL OR p_post IS NULL OR p_body IS NULL OR char_length(p_body) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='댓글을 입력해 주세요. 2000자까지 쓸 수 있습니다.';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.jp_comm_posts WHERE id=p_post AND NOT deleted) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='이 글에는 댓글을 작성할 수 없습니다.';
  END IF;
  SELECT * INTO previous FROM public.jp_comm_comments WHERE id=p_id;
  IF FOUND THEN
    IF previous.player_id<>p_player OR previous.post_id<>p_post THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='이 댓글을 수정할 수 없습니다.'; END IF;
    UPDATE public.jp_comm_comments SET body=p_body,updated_at=now(),deleted=false WHERE id=p_id RETURNING * INTO saved;
  ELSE
    IF (SELECT count(*) FROM public.jp_comm_comments WHERE player_id=p_player AND created_at >= ((now() AT TIME ZONE 'Asia/Seoul')::date::timestamp AT TIME ZONE 'Asia/Seoul'))>=30 THEN
      RAISE EXCEPTION USING ERRCODE='54000',MESSAGE='댓글은 하루 30개까지 작성할 수 있습니다.';
    END IF;
    INSERT INTO public.jp_comm_comments(id,post_id,player_id,body) VALUES(p_id,p_post,p_player,p_body) RETURNING * INTO saved;
  END IF;
  RETURN jsonb_build_object('id',saved.id,'postId',saved.post_id,'body',saved.body,'nickname',author.nickname,
    'profileId',author.profile_id,'createdAt',saved.created_at,'updatedAt',saved.updated_at);
END;
$$;
CREATE OR REPLACE FUNCTION public.jp_comm_remove(p_player uuid,p_secret text,p_kind text,p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE owner_id uuid;
BEGIN
  PERFORM public.jp_rank_auth(p_player,p_secret);
  PERFORM 1 FROM public.jp_rank_profiles WHERE player_id=p_player FOR UPDATE;
  IF p_kind='post' THEN SELECT player_id INTO owner_id FROM public.jp_comm_posts WHERE id=p_id;
  ELSIF p_kind='review' THEN SELECT player_id INTO owner_id FROM public.jp_comm_reviews WHERE id=p_id;
  ELSIF p_kind='comment' THEN SELECT player_id INTO owner_id FROM public.jp_comm_comments WHERE id=p_id;
  ELSE RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='삭제할 활동 종류를 확인해 주세요.';
  END IF;
  IF owner_id IS NULL OR owner_id<>p_player THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='본인이 작성한 활동만 삭제할 수 있습니다.'; END IF;
  IF p_kind='post' THEN UPDATE public.jp_comm_posts SET deleted=true,updated_at=now() WHERE id=p_id;
  ELSIF p_kind='review' THEN UPDATE public.jp_comm_reviews SET deleted=true,updated_at=now() WHERE id=p_id;
  ELSE UPDATE public.jp_comm_comments SET deleted=true,updated_at=now() WHERE id=p_id;
  END IF;
  RETURN '{"removed":true}'::jsonb;
END;
$$;

REVOKE ALL ON FUNCTION public.jp_comm_post_json(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.jp_comm_service_valid(text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.jp_comm_review_json(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.jp_comm_list(text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.jp_comm_get(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.jp_comm_post(uuid,text,uuid,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.jp_comm_review(uuid,text,uuid,text,integer,text,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.jp_comm_reviews(text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.jp_comm_remove(uuid,text,text,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.jp_comm_comments(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.jp_comm_comment(uuid,text,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.jp_comm_list(text) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.jp_comm_get(uuid) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.jp_comm_post(uuid,text,uuid,text,text,text,text,text) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.jp_comm_review(uuid,text,uuid,text,integer,text,text,text,text,text,text) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.jp_comm_reviews(text) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.jp_comm_remove(uuid,text,text,uuid) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.jp_comm_comments(uuid) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.jp_comm_comment(uuid,text,uuid,uuid,text) TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
