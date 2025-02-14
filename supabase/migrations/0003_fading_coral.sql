/*
  # Add Categories, Products, and Orders Tables

  1. New Tables
    - categories
      - id (uuid, primary key)
      - collection_id (uuid, foreign key)
      - name (text)
      - description (text)
      - type (text)
      - eligibility_rules (jsonb)
      - created_at (timestamp)

    - products
      - id (uuid, primary key)
      - category_id (uuid, foreign key)
      - collection_id (uuid, foreign key)
      - name (text)
      - description (text)
      - price (numeric)
      - quantity (integer)
      - images (text[])
      - created_at (timestamp)

    - orders
      - id (uuid, primary key)
      - product_id (uuid, foreign key)
      - user_id (uuid, foreign key)
      - quantity (integer)
      - total_price (numeric)
      - status (text)
      - shipping_address (jsonb)
      - transaction_hash (text)
      - created_at (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add appropriate policies for each table
*/

-- Categories Table
CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid REFERENCES collections(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  type text NOT NULL CHECK (type IN ('blank', 'whitelist', 'rules-based')),
  eligibility_rules jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view categories of visible collections"
  ON categories FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM collections 
    WHERE collections.id = categories.collection_id
  ));

CREATE POLICY "Users can manage their own categories"
  ON categories FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM collections 
    WHERE collections.id = categories.collection_id 
    AND collections.user_id = auth.uid()
  ));

-- Products Table
CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES categories(id) ON DELETE CASCADE NOT NULL,
  collection_id uuid REFERENCES collections(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  price numeric(10,2) NOT NULL CHECK (price >= 0),
  quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  images text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view products of visible collections"
  ON products FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM collections 
    WHERE collections.id = products.collection_id
  ));

CREATE POLICY "Users can manage their own products"
  ON products FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM collections 
    WHERE collections.id = products.collection_id 
    AND collections.user_id = auth.uid()
  ));

-- Orders Table
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE RESTRICT NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  total_price numeric(10,2) NOT NULL CHECK (total_price >= 0),
  status text NOT NULL CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')) DEFAULT 'pending',
  shipping_address jsonb NOT NULL,
  transaction_hash text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Buyers can view their own orders
CREATE POLICY "Users can view their own orders"
  ON orders FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Sellers can view orders for their products
CREATE POLICY "Sellers can view orders for their products"
  ON orders FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM products 
    JOIN collections ON products.collection_id = collections.id 
    WHERE products.id = orders.product_id 
    AND collections.user_id = auth.uid()
  ));

-- Only buyers can create orders
CREATE POLICY "Users can create their own orders"
  ON orders FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Only sellers can update order status
CREATE POLICY "Sellers can update order status"
  ON orders FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM products 
    JOIN collections ON products.collection_id = collections.id 
    WHERE products.id = orders.product_id 
    AND collections.user_id = auth.uid()
  ));