-- ============================================================
-- ConnectorHUB 管理员系统 SQL
-- 在 Supabase Dashboard → SQL Editor 中执行（在 discussions SQL 之后）
-- ============================================================

-- 1. 管理员用户表
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- 管理员互看权限
DROP POLICY IF EXISTS "admins_can_see_admins" ON public.admin_users;
CREATE POLICY "admins_can_see_admins" ON public.admin_users
  FOR SELECT USING (auth.uid() IN (SELECT user_id FROM public.admin_users));

-- 2. 权限判断函数
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()
  );
END;
$$;

-- 3. 获取所有注册用户（仅管理员可调用）
CREATE OR REPLACE FUNCTION public.admin_get_users()
RETURNS TABLE (
  id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  username text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Permission denied: not an admin';
  END IF;
  RETURN QUERY
  SELECT 
    au.id,
    au.email,
    au.created_at,
    au.last_sign_in_at,
    (au.raw_user_meta_data->>'username')::text
  FROM auth.users au
  ORDER BY au.created_at DESC;
END;
$$;

-- 4. 获取所有讨论帖（仅管理员可调用，含用户信息）
CREATE OR REPLACE FUNCTION public.admin_get_discussions()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  username text,
  email text,
  type text,
  title text,
  content text,
  like_count integer,
  reply_count integer,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Permission denied: not an admin';
  END IF;
  RETURN QUERY
  SELECT 
    d.id,
    d.user_id,
    d.username,
    COALESCE(u.email, '已删除用户')::text,
    d.type,
    d.title,
    d.content,
    d.like_count,
    d.reply_count,
    d.created_at
  FROM public.discussions d
  LEFT JOIN auth.users u ON d.user_id = u.id
  ORDER BY d.created_at DESC;
END;
$$;

-- 5. 获取所有回复（仅管理员可调用）
CREATE OR REPLACE FUNCTION public.admin_get_replies()
RETURNS TABLE (
  id uuid,
  discussion_id uuid,
  discussion_title text,
  user_id uuid,
  username text,
  email text,
  content text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Permission denied: not an admin';
  END IF;
  RETURN QUERY
  SELECT 
    r.id,
    r.discussion_id,
    d.title,
    r.user_id,
    r.username,
    COALESCE(u.email, '已删除用户')::text,
    r.content,
    r.created_at
  FROM public.discussion_replies r
  LEFT JOIN public.discussions d ON r.discussion_id = d.id
  LEFT JOIN auth.users u ON r.user_id = u.id
  ORDER BY r.created_at DESC;
END;
$$;

-- 6. 更新讨论区 RLS：管理员可查看所有
DROP POLICY IF EXISTS "admins_select_discussions" ON public.discussions;
CREATE POLICY "admins_select_discussions" ON public.discussions
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "admins_select_replies" ON public.discussion_replies;
CREATE POLICY "admins_select_replies" ON public.discussion_replies
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "admins_select_likes" ON public.discussion_likes;
CREATE POLICY "admins_select_likes" ON public.discussion_likes
  FOR SELECT USING (public.is_admin());

-- ============================================================
-- 提示：执行后将你的账号设为管理员
-- 先注册一个账号，然后在这里填入你的 user_id 再执行：
-- INSERT INTO public.admin_users (user_id) 
-- VALUES ('your-user-id-here');
-- ============================================================
