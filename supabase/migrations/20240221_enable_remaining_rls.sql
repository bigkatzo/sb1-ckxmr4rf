-- Enable RLS for remaining tables
DO $$ 
BEGIN
    -- collection_access table
    ALTER TABLE collection_access ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Admins can manage all access" ON collection_access;
    DROP POLICY IF EXISTS "Collection owners can manage access" ON collection_access;
    DROP POLICY IF EXISTS "Users can view their own access" ON collection_access;
    
    CREATE POLICY "Admins can manage all access"
    ON collection_access
    FOR ALL
    TO authenticated
    USING (auth.is_admin())
    WITH CHECK (auth.is_admin());
    
    CREATE POLICY "Collection owners can manage access"
    ON collection_access
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM collections c
            WHERE c.id = collection_access.collection_id
            AND c.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM collections c
            WHERE c.id = collection_access.collection_id
            AND c.user_id = auth.uid()
        )
    );
    
    CREATE POLICY "Users can view their own access"
    ON collection_access
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

    -- categories table
    ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Anyone can view categories" ON categories;
    DROP POLICY IF EXISTS "Collection owners can manage categories" ON categories;
    DROP POLICY IF EXISTS "Users with collection access can manage categories" ON categories;
    
    CREATE POLICY "Anyone can view categories"
    ON categories
    FOR SELECT
    TO authenticated
    USING (true);
    
    CREATE POLICY "Collection owners can manage categories"
    ON categories
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM collections c
            WHERE c.id = categories.collection_id
            AND c.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM collections c
            WHERE c.id = categories.collection_id
            AND c.user_id = auth.uid()
        )
    );
    
    CREATE POLICY "Users with collection access can manage categories"
    ON categories
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM collection_access ca
            WHERE ca.collection_id = categories.collection_id
            AND ca.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM collection_access ca
            WHERE ca.collection_id = categories.collection_id
            AND ca.user_id = auth.uid()
        )
    );

    -- products table
    ALTER TABLE products ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Anyone can view products" ON products;
    DROP POLICY IF EXISTS "Collection owners can manage products" ON products;
    DROP POLICY IF EXISTS "Users with collection access can manage products" ON products;
    
    CREATE POLICY "Anyone can view products"
    ON products
    FOR SELECT
    TO authenticated
    USING (true);
    
    CREATE POLICY "Collection owners can manage products"
    ON products
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM collections c
            WHERE c.id = products.collection_id
            AND c.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM collections c
            WHERE c.id = products.collection_id
            AND c.user_id = auth.uid()
        )
    );
    
    CREATE POLICY "Users with collection access can manage products"
    ON products
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM collection_access ca
            WHERE ca.collection_id = products.collection_id
            AND ca.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM collection_access ca
            WHERE ca.collection_id = products.collection_id
            AND ca.user_id = auth.uid()
        )
    );

    RAISE NOTICE 'RLS enabled and policies created for collection_access, categories, and products tables';
END $$;

-- Verify RLS is enabled and policies are in place
DO $$
BEGIN
    -- Check collection_access
    IF EXISTS (
        SELECT 1
        FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename = 'collection_access'
        AND rowsecurity = true
    ) THEN
        RAISE NOTICE 'RLS is enabled for collection_access';
    ELSE
        RAISE WARNING 'RLS is NOT enabled for collection_access';
    END IF;

    -- Check categories
    IF EXISTS (
        SELECT 1
        FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename = 'categories'
        AND rowsecurity = true
    ) THEN
        RAISE NOTICE 'RLS is enabled for categories';
    ELSE
        RAISE WARNING 'RLS is NOT enabled for categories';
    END IF;

    -- Check products
    IF EXISTS (
        SELECT 1
        FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename = 'products'
        AND rowsecurity = true
    ) THEN
        RAISE NOTICE 'RLS is enabled for products';
    ELSE
        RAISE WARNING 'RLS is NOT enabled for products';
    END IF;

    -- Check policies
    IF EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename IN ('collection_access', 'categories', 'products')
    ) THEN
        RAISE NOTICE 'Policies are configured for all tables';
    ELSE
        RAISE WARNING 'Missing policies for one or more tables';
    END IF;
END $$; 