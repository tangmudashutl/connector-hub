-- ============================================================
-- ConnectorHUB 交流讨论区 - Supabase 建表 SQL
-- 在 Supabase Dashboard → SQL Editor 中执行此文件
-- ============================================================

-- 1. 讨论主贴表
CREATE TABLE IF NOT EXISTS public.discussions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  username text DEFAULT '匿名',
  type text DEFAULT 'discussion' CHECK (type IN ('question','request','discussion','suggestion')),
  title text NOT NULL,
  content text NOT NULL,
  like_count integer DEFAULT 0,
  reply_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. 回复表
CREATE TABLE IF NOT EXISTS public.discussion_replies (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  discussion_id uuid REFERENCES public.discussions(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  username text DEFAULT '匿名',
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 3. 点赞表
CREATE TABLE IF NOT EXISTS public.discussion_likes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  discussion_id uuid REFERENCES public.discussions(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, discussion_id)
);

-- ============================================================
-- 启用 RLS（行级安全）
-- ============================================================
ALTER TABLE public.discussions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discussion_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discussion_likes ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 讨论主贴权限：所有人可读，登录用户可写
-- ============================================================
DROP POLICY IF EXISTS "discussions_select" ON public.discussions;
CREATE POLICY "discussions_select" ON public.discussions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "discussions_insert" ON public.discussions;
CREATE POLICY "discussions_insert" ON public.discussions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "discussions_update" ON public.discussions;
CREATE POLICY "discussions_update" ON public.discussions
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================
-- 回复权限：所有人可读，登录用户可写
-- ============================================================
DROP POLICY IF EXISTS "replies_select" ON public.discussion_replies;
CREATE POLICY "replies_select" ON public.discussion_replies
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "replies_insert" ON public.discussion_replies;
CREATE POLICY "replies_insert" ON public.discussion_replies
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 点赞权限：所有人可看，登录用户可点赞/取消
-- ============================================================
DROP POLICY IF EXISTS "likes_select" ON public.discussion_likes;
CREATE POLICY "likes_select" ON public.discussion_likes
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "likes_insert" ON public.discussion_likes;
CREATE POLICY "likes_insert" ON public.discussion_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "likes_delete" ON public.discussion_likes;
CREATE POLICY "likes_delete" ON public.discussion_likes
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 数据库触发器：自动更新 reply_count
-- ============================================================

-- 回复数 +1
CREATE OR REPLACE FUNCTION public.increment_reply_count()
RETURNS trigger AS $$
BEGIN
  UPDATE public.discussions
  SET reply_count = reply_count + 1,
      updated_at = now()
  WHERE id = NEW.discussion_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 回复数 -1
CREATE OR REPLACE FUNCTION public.decrement_reply_count()
RETURNS trigger AS $$
BEGIN
  UPDATE public.discussions
  SET reply_count = GREATEST(0, reply_count - 1),
      updated_at = now()
  WHERE id = OLD.discussion_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 点赞数 +1
CREATE OR REPLACE FUNCTION public.increment_like_count()
RETURNS trigger AS $$
BEGIN
  UPDATE public.discussions
  SET like_count = like_count + 1
  WHERE id = NEW.discussion_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 点赞数 -1
CREATE OR REPLACE FUNCTION public.decrement_like_count()
RETURNS trigger AS $$
BEGIN
  UPDATE public.discussions
  SET like_count = GREATEST(0, like_count - 1)
  WHERE id = OLD.discussion_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 绑定触发器
DROP TRIGGER IF EXISTS on_reply_insert ON public.discussion_replies;
CREATE TRIGGER on_reply_insert
  AFTER INSERT ON public.discussion_replies
  FOR EACH ROW EXECUTE FUNCTION public.increment_reply_count();

DROP TRIGGER IF EXISTS on_reply_delete ON public.discussion_replies;
CREATE TRIGGER on_reply_delete
  AFTER DELETE ON public.discussion_replies
  FOR EACH ROW EXECUTE FUNCTION public.decrement_reply_count();

DROP TRIGGER IF EXISTS on_like_insert ON public.discussion_likes;
CREATE TRIGGER on_like_insert
  AFTER INSERT ON public.discussion_likes
  FOR EACH ROW EXECUTE FUNCTION public.increment_like_count();

DROP TRIGGER IF EXISTS on_like_delete ON public.discussion_replies;
CREATE TRIGGER on_like_delete
  AFTER DELETE ON public.discussion_likes
  FOR EACH ROW EXECUTE FUNCTION public.decrement_like_count();

-- ============================================================
-- 允许匿名（未登录）用户读取数据
-- ============================================================
-- 在 Supabase Dashboard → Authentication → Policies 中，
-- 确保 anon 角色的 SELECT 权限已开启
-- 或者执行以下命令（需要 service_role 权限）：
-- GRANT SELECT ON public.discussions TO anon;
-- GRANT SELECT ON public.discussion_replies TO anon;
-- GRANT SELECT ON public.discussion_likes TO anon;

-- ============================================================
-- 完成提示
-- ============================================================
-- SELECT '讨论区数据表创建完成！' AS result;
