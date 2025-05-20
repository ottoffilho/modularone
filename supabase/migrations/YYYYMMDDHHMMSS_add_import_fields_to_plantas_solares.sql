-- Adicionar novas colunas à tabela plantas_solares

ALTER TABLE public.plantas_solares
ADD COLUMN fabricante_id UUID REFERENCES public.fabricantes_equipamentos(id) ON DELETE SET NULL,
ADD COLUMN id_externo_planta TEXT,
ADD COLUMN dados_importacao_api JSONB;

-- Comentários para as novas colunas (opcional, mas bom para documentação)
COMMENT ON COLUMN public.plantas_solares.fabricante_id IS 'Referência ao fabricante do equipamento de onde esta planta foi importada.';
COMMENT ON COLUMN public.plantas_solares.id_externo_planta IS 'ID único da planta no sistema do fabricante/API externa.';
COMMENT ON COLUMN public.plantas_solares.dados_importacao_api IS 'Dados adicionais retornados pela API do fabricante durante a importação.';

-- Tornar colunas que devem ser NOT NULL como tal após verificar dados existentes (se houver)
-- Para novas implementações, podemos definir como NOT NULL diretamente se a lógica de inserção garantir.
-- Assumindo que para novas importações, fabricante_id e id_externo_planta serão sempre preenchidos.
-- Se a tabela já tiver dados, pode ser necessário um update antes ou permitir NULL temporariamente.

-- ALTER TABLE public.plantas_solares
-- ALTER COLUMN fabricante_id SET NOT NULL,
-- ALTER COLUMN id_externo_planta SET NOT NULL;
-- Nota: Decidi deixar NULL por enquanto para não quebrar inserções existentes que não usam esses campos.
-- A lógica de importação no frontend/backend DEVE garantir que eles sejam preenchidos.
-- Se a tabela for nova ou vazia, pode-se usar SET NOT NULL.


-- Adicionar a constraint UNIQUE para previnir duplicatas de importação
-- Esta constraint garante que um usuário não possa ter a mesma planta (id_externo_planta) do mesmo fabricante (fabricante_id) duas vezes.
ALTER TABLE public.plantas_solares
ADD CONSTRAINT plantas_solares_user_fabricante_id_externo_key 
UNIQUE (user_id, fabricante_id, id_externo_planta);

PRINT 
'Migração para adicionar campos de importação e constraint de unicidade à tabela plantas_solares concluída.';

-- Considerações:
-- 1. Se a tabela plantas_solares já contiver dados e você quiser definir
--    fabricante_id e id_externo_planta como NOT NULL, você precisará primeiro
--    popular esses campos para os registros existentes ou decidir como lidar com eles.
--    Para uma nova funcionalidade, a lógica de importação garantirá que sejam preenchidos.
-- 2. A política ON DELETE SET NULL para fabricante_id significa que se um fabricante for deletado,
--    a referência na planta solar se tornará NULL. Considere se CASCADE ou RESTRICT seria mais apropriado
--    dependendo da sua lógica de negócio. 