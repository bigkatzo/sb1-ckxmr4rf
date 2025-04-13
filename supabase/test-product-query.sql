-- SQL script to check product data directly
-- Test query for product data (replace with your product ID)

-- 1. First query the direct products table
SELECT 
  id,
  notes,
  free_notes,
  pg_typeof(notes) as notes_type,
  pg_typeof(free_notes) as free_notes_type
FROM products
WHERE id = 'd6aaf20e-58e4-4444-a0ae-401993313a5c';

-- 2. Then check the public_products view
SELECT 
  id,
  notes,
  free_notes,
  pg_typeof(notes) as notes_type,
  pg_typeof(free_notes) as free_notes_type
FROM public_products
WHERE id = 'd6aaf20e-58e4-4444-a0ae-401993313a5c';

-- 3. Check column definitions 
SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'products' 
AND column_name IN ('notes', 'free_notes');

-- This is just a diagnostic query and doesn't modify any data 