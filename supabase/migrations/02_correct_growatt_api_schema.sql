-- Migração para corrigir a estrutura da API Growatt e padronizar nomes de campos
-- Esta migração visa resolver problemas de inconsistência em nomes de campos nas credenciais

-- 1. Atualizar as entradas existentes na tabela fabricantes_equipamentos para o Growatt
-- Nota: É necessário primeiro verificar se a entrada existe
DO $$
DECLARE
    growatt_id UUID;
BEGIN
    -- Obter o ID do fabricante Growatt se existir
    SELECT id INTO growatt_id FROM fabricantes_equipamentos WHERE nome = 'Growatt' OR identificador_api = 'GROWATT_API' LIMIT 1;
    
    IF growatt_id IS NOT NULL THEN
        -- Atualizar o schema da API para usar os nomes de campos padronizados
        UPDATE fabricantes_equipamentos
        SET api_config_schema = jsonb_build_object(
            'fields', jsonb_build_array(
                jsonb_build_object(
                    'name', 'username',
                    'label', 'Nome de Usuário',
                    'type', 'text',
                    'required', true,
                    'placeholder', 'Seu nome de usuário Growatt',
                    'encrypt', false
                ),
                jsonb_build_object(
                    'name', 'password',
                    'label', 'Senha',
                    'type', 'password',
                    'required', true,
                    'placeholder', 'Sua senha Growatt',
                    'encrypt', true
                )
            )
        )
        WHERE id = growatt_id;
        
        RAISE NOTICE 'Atualizado schema da API do fabricante Growatt com ID: %', growatt_id;
    ELSE
        RAISE NOTICE 'Fabricante Growatt não encontrado. Nenhuma atualização realizada.';
    END IF;
END $$;

-- 2. Migrar dados existentes da tabela credenciais_servico_usuario
-- Atualizar entradas existentes para usar os novos nomes de campos padronizados
DO $$
DECLARE
    cred_record RECORD;
    growatt_id UUID;
    new_credentials JSONB;
BEGIN
    -- Obter o ID do fabricante Growatt
    SELECT id INTO growatt_id FROM fabricantes_equipamentos WHERE nome = 'Growatt' OR identificador_api = 'GROWATT_API' LIMIT 1;
    
    IF growatt_id IS NULL THEN
        RAISE NOTICE 'Fabricante Growatt não encontrado. Nenhuma migração de credenciais realizada.';
        RETURN;
    END IF;
    
    -- Loop através de credenciais para o fabricante Growatt
    FOR cred_record IN 
        SELECT id, credenciais_seguras FROM credenciais_servico_usuario 
        WHERE fabricante_id = growatt_id
    LOOP
        new_credentials := '{}'::jsonb;
        
        -- Migrar campo username_growatt para username
        IF cred_record.credenciais_seguras ? 'username_growatt' THEN
            new_credentials := jsonb_set(new_credentials, '{username}', cred_record.credenciais_seguras->'username_growatt');
        -- Ou usar campo account se existir
        ELSIF cred_record.credenciais_seguras ? 'account' THEN
            new_credentials := jsonb_set(new_credentials, '{username}', cred_record.credenciais_seguras->'account');
        -- Ou manter username se já existir
        ELSIF cred_record.credenciais_seguras ? 'username' THEN
            new_credentials := jsonb_set(new_credentials, '{username}', cred_record.credenciais_seguras->'username');
        END IF;
        
        -- Migrar campo password_growatt para password
        IF cred_record.credenciais_seguras ? 'password_growatt' THEN
            new_credentials := jsonb_set(new_credentials, '{password}', cred_record.credenciais_seguras->'password_growatt');
        -- Ou manter password se já existir
        ELSIF cred_record.credenciais_seguras ? 'password' THEN
            new_credentials := jsonb_set(new_credentials, '{password}', cred_record.credenciais_seguras->'password');
        END IF;
        
        -- Atualizar registro com credenciais padronizadas
        UPDATE credenciais_servico_usuario
        SET credenciais_seguras = new_credentials
        WHERE id = cred_record.id;
        
        RAISE NOTICE 'Migradas credenciais para o registro: %', cred_record.id;
    END LOOP;
END $$;

-- 3. Verificar e corrigir referências a fabricantes_api se necessário
DO $$
BEGIN
    -- Verificar se há alguma foreign key referenciando fabricantes_api em vez de fabricantes_equipamentos
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'fabricantes_api'
    ) THEN
        RAISE NOTICE 'Existem chaves estrangeiras referenciando fabricantes_api. Considere atualizá-las para fabricantes_equipamentos.';
    END IF;
END $$;

-- 4. Verificar tabela credenciais_servico_usuario para garantir que tem os campos necessários
DO $$
BEGIN
    -- Verifica se existe coluna status_validacao e adiciona se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'credenciais_servico_usuario' AND column_name = 'status_validacao'
    ) THEN
        ALTER TABLE credenciais_servico_usuario 
        ADD COLUMN status_validacao TEXT DEFAULT 'NAO_VALIDADO';
        
        RAISE NOTICE 'Adicionada coluna status_validacao à tabela credenciais_servico_usuario';
    END IF;
    
    -- Verifica se existe coluna ultima_validacao_em e adiciona se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'credenciais_servico_usuario' AND column_name = 'ultima_validacao_em'
    ) THEN
        ALTER TABLE credenciais_servico_usuario 
        ADD COLUMN ultima_validacao_em TIMESTAMPTZ;
        
        RAISE NOTICE 'Adicionada coluna ultima_validacao_em à tabela credenciais_servico_usuario';
    END IF;
END $$; 