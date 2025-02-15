-- 1. Check RLS policies on user_profiles
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'user_profiles';

-- 2. Check if auth functions exist and are properly secured
SELECT p.proname, p.pronamespace::regnamespace as schema, p.prosecdef as security_definer
FROM pg_proc p
WHERE p.proname IN ('is_admin', 'has_merchant_access', 'admin_list_users', 'handle_new_user')
ORDER BY p.proname;

-- 3. Check triggers on auth.users
SELECT 
    t.tgname as trigger_name,
    CASE t.tgtype & 2 WHEN 2 THEN 'BEFORE' ELSE 'AFTER' END as timing,
    CASE t.tgtype & 28
        WHEN 16 THEN 'UPDATE'
        WHEN 8 THEN 'DELETE'
        WHEN 4 THEN 'INSERT'
    END as event,
    p.proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE t.tgrelid = 'auth.users'::regclass;

-- 4. Check permissions on relevant schemas and functions
SELECT 
    n.nspname as schema,
    CASE c.relkind
        WHEN 'r' THEN 'table'
        WHEN 'v' THEN 'view'
        WHEN 'm' THEN 'materialized view'
        WHEN 'S' THEN 'sequence'
        WHEN 'f' THEN 'foreign table'
    END as object_type,
    c.relname as object_name,
    array_agg(a.privilege_type) as privileges
FROM pg_catalog.pg_namespace n
JOIN pg_catalog.pg_class c ON c.relnamespace = n.oid
LEFT JOIN LATERAL (
    SELECT privilege_type
    FROM aclexplode(c.relacl) a
    WHERE a.grantee = 'authenticated'::regrole
) a ON true
WHERE n.nspname IN ('auth', 'public')
AND c.relname IN ('user_profiles')
GROUP BY n.nspname, c.relkind, c.relname;

-- 5. Check existing user profiles and their roles
SELECT 
    u.email,
    p.role,
    u.raw_app_meta_data->>'role' as metadata_role,
    u.role as auth_role
FROM auth.users u
LEFT JOIN user_profiles p ON p.id = u.id
ORDER BY u.created_at DESC;

-- 6. Verify admin function works
DO $$ 
DECLARE
    v_admin_id uuid;
    v_is_admin boolean;
BEGIN
    -- Get an admin user
    SELECT id INTO v_admin_id
    FROM user_profiles
    WHERE role = 'admin'
    LIMIT 1;

    IF v_admin_id IS NULL THEN
        RAISE NOTICE 'No admin users found in user_profiles';
        RETURN;
    END IF;

    -- Set local role to authenticated
    SET LOCAL ROLE authenticated;
    
    -- Set auth.uid() to the admin user
    PERFORM set_config('request.jwt.claim.sub', v_admin_id::text, true);
    
    -- Test is_admin() function
    SELECT auth.is_admin() INTO v_is_admin;
    
    RAISE NOTICE 'Admin check result for user %: %', v_admin_id, v_is_admin;
END $$;

-- 7. Create a test admin if none exists
DO $$ 
DECLARE
    v_user_id uuid;
BEGIN
    -- Check if we have any admin users
    IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE role = 'admin') THEN
        -- Create a test admin user
        INSERT INTO auth.users (
            instance_id,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            role,
            created_at,
            updated_at
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            'admin@test.com',
            crypt('adminpass123', gen_salt('bf')),
            now(),
            jsonb_build_object('role', 'admin'),
            jsonb_build_object('role', 'admin'),
            'authenticated',
            now(),
            now()
        ) RETURNING id INTO v_user_id;

        -- Create admin profile
        INSERT INTO user_profiles (id, role)
        VALUES (v_user_id, 'admin');

        RAISE NOTICE 'Created test admin user with ID: %', v_user_id;
    END IF;
END $$; 