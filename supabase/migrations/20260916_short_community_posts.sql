-- Allow one-character posts, titles and comments without changing any saved content.
-- Existing table and function permissions are preserved by CREATE OR REPLACE.
BEGIN;
ALTER TABLE public.jp_comm_posts
  DROP CONSTRAINT IF EXISTS jp_comm_posts_title_check,
  DROP CONSTRAINT IF EXISTS jp_comm_posts_body_check,
  ADD CONSTRAINT jp_comm_posts_title_check CHECK(char_length(title) BETWEEN 1 AND 100 AND title ~ '[^[:space:]]'),
  ADD CONSTRAINT jp_comm_posts_body_check CHECK(char_length(body) BETWEEN 1 AND 5000 AND body ~ '[^[:space:]]');
ALTER TABLE public.jp_comm_comments
  DROP CONSTRAINT IF EXISTS jp_comm_comments_body_check,
  ADD CONSTRAINT jp_comm_comments_body_check CHECK(char_length(body) BETWEEN 1 AND 2000 AND body ~ '[^[:space:]]');

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

NOTIFY pgrst,'reload schema';
COMMIT;
