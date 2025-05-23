-- Criação do enum fabricante_enum se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fabricante_enum') THEN
    CREATE TYPE public.fabricante_enum AS ENUM ('GROWATT', 'SAJ', 'FRONIUS', 'SUNGROW', 'HUAWEI', 'GOODWE', 'OUTRO');
  END IF;
END $$;

-- Comentário no enum
COMMENT ON TYPE public.fabricante_enum IS 'Enum que lista os fabricantes de inversores suportados pelo sistema';

-- Adiciona a coluna fabricante_inversor à tabela plantas_solares
ALTER TABLE public.plantas_solares
ADD COLUMN fabricante_inversor public.fabricante_enum NOT NULL;

-- Adiciona um comentário à nova coluna para documentação
COMMENT ON COLUMN public.plantas_solares.fabricante_inversor IS 'Fabricante do inversor principal da planta solar, utiliza o enum public.fabricante_enum.'; 