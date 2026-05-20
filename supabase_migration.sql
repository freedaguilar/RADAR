-- Create enum types
CREATE TYPE user_role AS ENUM ('gestor', 'vendedor');

-- Create products table
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT,
  weight TEXT,
  image_url TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  base_price DECIMAL(10, 2) NOT NULL,
  is_competitor BOOLEAN DEFAULT false,
  brand TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create chains table
CREATE TABLE chains (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  logo_color TEXT NOT NULL,
  logo_url TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create custom users table
CREATE TABLE app_users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role user_role DEFAULT 'vendedor',
  active BOOLEAN DEFAULT true,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create price records table
CREATE TABLE price_records (
  id TEXT PRIMARY KEY,
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  chain_id TEXT REFERENCES chains(id) ON DELETE CASCADE,
  price DECIMAL(10, 2) NOT NULL,
  date DATE NOT NULL,
  image_url TEXT,
  notes TEXT,
  user_name TEXT,
  user_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE chains ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_records ENABLE ROW LEVEL SECURITY;

-- Create basic RLS policies
DROP POLICY IF EXISTS "Allow all operations for authenticated users on products" ON products;
DROP POLICY IF EXISTS "Allow all operations for authenticated users on chains" ON chains;
DROP POLICY IF EXISTS "Allow all operations for authenticated users on app_users" ON app_users;
DROP POLICY IF EXISTS "Allow all operations for authenticated users on price_records" ON price_records;

DROP POLICY IF EXISTS "Allow public read on products" ON products;
DROP POLICY IF EXISTS "Allow public read on chains" ON chains;
DROP POLICY IF EXISTS "Allow public read on price_records" ON price_records;
DROP POLICY IF EXISTS "Allow public insert on price_records" ON price_records;

-- Allow public access for all operations (since we are not using Supabase Auth, we need to use the anon role)
CREATE POLICY "Allow public all on products" ON products FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on chains" ON chains FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on price_records" ON price_records FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on app_users" ON app_users FOR ALL TO public USING (true) WITH CHECK (true);
