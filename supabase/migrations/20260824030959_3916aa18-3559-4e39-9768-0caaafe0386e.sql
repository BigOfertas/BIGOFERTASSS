CREATE TABLE public.products (   
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),   
  name TEXT NOT NULL,   
  price NUMERIC(10, 2) NOT NULL,   
  image_url TEXT NOT NULL,   
  description TEXT,   
  category TEXT,   
  campeonato TEXT,   
  liga TEXT,   
  time TEXT,   
  stock INTEGER DEFAULT 0,   
  specifications TEXT,   
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,   
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP 
); 

GRANT SELECT ON public.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;

-- Criar índices para buscas rápidas (filtros) 
CREATE INDEX idx_products_campeonato ON products(campeonato); 
CREATE INDEX idx_products_liga ON products(liga); 
CREATE INDEX idx_products_time ON products(time); 
CREATE INDEX idx_products_category ON products(category); 

-- RLS: Qualquer um pode ler, apenas admin pode escrever 
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY; 

CREATE POLICY "Anyone can read products"   
  ON public.products FOR SELECT   
  USING (true); 

CREATE POLICY "Only admin can insert products"   
  ON public.products FOR INSERT   
  WITH CHECK (public.has_role('owner'::public.app_role)); 

CREATE POLICY "Only admin can update products"   
  ON public.products FOR UPDATE   
  USING (public.has_role('owner'::public.app_role))   
  WITH CHECK (public.has_role('owner'::public.app_role)); 

CREATE POLICY "Only admin can delete products"   
  ON public.products FOR DELETE   
  USING (public.has_role('owner'::public.app_role));

-- Seed initial data
INSERT INTO public.products (name, price, image_url, description, category, stock, specifications)
VALUES (
  'Camisa Profissional BIGofertas 2024', 
  199.90, 
  'https://placehold.co/600x800/dc2626/ffffff?text=Camisa+BIGofertas', 
  'A nova camisa profissional da BIGofertas combina tecnologia de ponta com o estilo clássico que você já conhece. Perfeita para torcer ou para a prática esportiva.', 
  'Camisas', 
  10, 
  'Material: 100% Poliéster | Tecnologia: Dry-Fit | Marca: BIGofertas | Origem: Nacional'
);