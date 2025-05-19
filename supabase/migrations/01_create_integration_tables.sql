-- Criação da tabela de fabricantes de equipamentos
CREATE TABLE IF NOT EXISTS public.fabricantes_equipamentos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  descricao TEXT,
  suporta_api_dados BOOLEAN NOT NULL DEFAULT FALSE,
  api_config_schema JSONB,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE
);

-- Comentários das colunas
COMMENT ON TABLE public.fabricantes_equipamentos IS 'Armazena os fabricantes de equipamentos solares que podem ser integrados ao sistema';
COMMENT ON COLUMN public.fabricantes_equipamentos.id IS 'ID único do fabricante';
COMMENT ON COLUMN public.fabricantes_equipamentos.nome IS 'Nome do fabricante (ex: Growatt, Fronius, etc)';
COMMENT ON COLUMN public.fabricantes_equipamentos.descricao IS 'Descrição do fabricante, incluindo informações relevantes';
COMMENT ON COLUMN public.fabricantes_equipamentos.suporta_api_dados IS 'Indica se o fabricante suporta integração via API';
COMMENT ON COLUMN public.fabricantes_equipamentos.api_config_schema IS 'Esquema JSON que define os campos necessários para configurar a API';
COMMENT ON COLUMN public.fabricantes_equipamentos.user_id IS 'ID do usuário que criou o registro';
COMMENT ON COLUMN public.fabricantes_equipamentos.created_at IS 'Data e hora de criação do registro';
COMMENT ON COLUMN public.fabricantes_equipamentos.updated_at IS 'Data e hora da última atualização do registro';

-- Criação da tabela de credenciais de serviço do usuário
CREATE TABLE IF NOT EXISTS public.credenciais_servico_usuario (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  fabricante_id UUID REFERENCES public.fabricantes_equipamentos(id) NOT NULL,
  credenciais_seguras JSONB NOT NULL,
  nome_referencia TEXT,
  status_validacao TEXT DEFAULT 'PENDENTE',
  ultima_validacao_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, fabricante_id)
);

-- Comentários das colunas
COMMENT ON TABLE public.credenciais_servico_usuario IS 'Armazena as credenciais de serviço do usuário para integrações com APIs de fabricantes';
COMMENT ON COLUMN public.credenciais_servico_usuario.id IS 'ID único da credencial';
COMMENT ON COLUMN public.credenciais_servico_usuario.user_id IS 'ID do usuário proprietário das credenciais';
COMMENT ON COLUMN public.credenciais_servico_usuario.fabricante_id IS 'ID do fabricante ao qual as credenciais se referem';
COMMENT ON COLUMN public.credenciais_servico_usuario.credenciais_seguras IS 'Objeto JSON com credenciais criptografadas';
COMMENT ON COLUMN public.credenciais_servico_usuario.nome_referencia IS 'Nome de referência opcional para a credencial';
COMMENT ON COLUMN public.credenciais_servico_usuario.status_validacao IS 'Status da validação das credenciais: PENDENTE, VALIDO, INVALIDO';
COMMENT ON COLUMN public.credenciais_servico_usuario.ultima_validacao_em IS 'Data e hora da última validação das credenciais';
COMMENT ON COLUMN public.credenciais_servico_usuario.created_at IS 'Data e hora de criação do registro';
COMMENT ON COLUMN public.credenciais_servico_usuario.updated_at IS 'Data e hora da última atualização do registro';

-- Permissões RLS (Row Level Security)
ALTER TABLE public.fabricantes_equipamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credenciais_servico_usuario ENABLE ROW LEVEL SECURITY;

-- Políticas para fabricantes_equipamentos
CREATE POLICY "Fabricantes visíveis para todos os usuários autenticados" 
  ON public.fabricantes_equipamentos FOR SELECT 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Usuários admin podem gerenciar fabricantes" 
  ON public.fabricantes_equipamentos FOR ALL 
  USING (auth.role() = 'authenticated' AND (
    -- Aqui você pode adicionar lógica para verificar se o usuário é admin
    -- Como por exemplo, verificar em uma tabela de roles ou algum outro critério
    user_id = auth.uid()
  ));

-- Políticas para credenciais_servico_usuario
CREATE POLICY "Usuários podem ver apenas suas próprias credenciais" 
  ON public.credenciais_servico_usuario FOR SELECT 
  USING (auth.role() = 'authenticated' AND user_id = auth.uid());

CREATE POLICY "Usuários podem inserir suas próprias credenciais" 
  ON public.credenciais_servico_usuario FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated' AND user_id = auth.uid());

CREATE POLICY "Usuários podem atualizar suas próprias credenciais" 
  ON public.credenciais_servico_usuario FOR UPDATE 
  USING (auth.role() = 'authenticated' AND user_id = auth.uid());

CREATE POLICY "Usuários podem excluir suas próprias credenciais" 
  ON public.credenciais_servico_usuario FOR DELETE 
  USING (auth.role() = 'authenticated' AND user_id = auth.uid());

-- Inserir dados iniciais para o fabricante Growatt (opcional, você pode fazer isso manualmente)
INSERT INTO public.fabricantes_equipamentos (
  nome, 
  descricao, 
  suporta_api_dados, 
  api_config_schema, 
  user_id
) VALUES (
  'Growatt',
  'Fabricante de inversores solares e sistemas de monitoramento',
  TRUE,
  '{
    "fields": [
      { "name": "username_growatt", "label": "Usuário Growatt", "type": "text", "required": true },
      { "name": "password_growatt", "label": "Senha Growatt", "type": "password", "required": true }
    ]
  }',
  '00000000-0000-0000-0000-000000000000' -- Substitua pelo ID do usuário admin
)
ON CONFLICT (id) DO NOTHING; 