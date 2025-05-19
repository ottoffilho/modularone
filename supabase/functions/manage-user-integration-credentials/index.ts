// Edge Function para gerenciar credenciais de integração do usuário
// Esta função recebe credenciais do usuário, criptografa dados sensíveis e os armazena no banco de dados

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from '../_shared/cors.ts';

// Interface para o payload recebido
interface CredentialPayload {
  fabricante_id: string;
  credenciais_objeto: Record<string, string>;
  nome_referencia?: string;
}

// Interface para as respostas da API
interface ApiResponse {
  success: boolean;
  message: string;
  data?: {
    id: string;
    status: string;
    validated_at: string;
    nome_referencia: string;
  } | any; // Para respostas de listagem
}

// Interface para a configuração da API do fabricante
interface ApiConfigField {
  name: string;
  label: string;
  type: string;
  required: boolean;
}

interface ApiConfigSchema {
  fields: ApiConfigField[];
}

// Função para criptografar dados sensíveis
async function encryptSensitiveData(data: string, key: string): Promise<{ encrypted: string, iv: string }> {
  // Converter a chave para formato adequado (32 bytes para AES-256)
  const keyBytes = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(key)
  );
  
  // Gerar vetor de inicialização (IV)
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  
  // Configurar chave criptográfica
  const cryptoKey = await globalThis.crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );
  
  // Criptografar dados
  const encodedData = new TextEncoder().encode(data);
  const encryptedData = await globalThis.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    encodedData
  );
  
  // Converter para strings base64 para armazenamento
  const encryptedBase64 = btoa(String.fromCharCode(...new Uint8Array(encryptedData)));
  const ivBase64 = btoa(String.fromCharCode(...iv));
  
  return {
    encrypted: encryptedBase64,
    iv: ivBase64
  };
}

// Função para descriptografar dados
async function decryptSensitiveData(encrypted: string, iv: string, key: string): Promise<string> {
  try {
    // Converter a chave para formato adequado
    const keyBytes = await globalThis.crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(key)
    );
    
    // Configurar chave criptográfica
    const cryptoKey = await globalThis.crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );
    
    // Converter de base64 para ArrayBuffer
    const encryptedBytes = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
    const ivBytes = Uint8Array.from(atob(iv), c => c.charCodeAt(0));
    
    // Descriptografar dados
    const decryptedData = await globalThis.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: ivBytes },
      cryptoKey,
      encryptedBytes
    );
    
    // Converter para string
    return new TextDecoder().decode(decryptedData);
  } catch (error) {
    console.error("Erro ao descriptografar dados:", error);
    throw new Error("Falha ao descriptografar dados");
  }
}

// Função para validar credenciais com a API do fabricante
async function validateCredentials(
  fabricanteId: string, 
  credenciaisSeguras: Record<string, unknown>,
  masterKey: string
): Promise<{ isValid: boolean; message: string }> {
  try {
    // Aqui você implementaria a lógica real de validação com cada API de fabricante
    // Isso envolveria:
    // 1. Descriptografar as credenciais necessárias
    // 2. Fazer chamadas de teste à API do fabricante
    // 3. Verificar se as respostas são válidas
    
    // Como exemplo, vamos implementar uma validação mais realista simulada:
    if (fabricanteId === 'fab_growatt') {
      // Simulando validação para Growatt
      const username = credenciaisSeguras['username_growatt'] as { value: string, iv?: string, sensitive: boolean };
      
      if (!username || !username.value) {
        return { isValid: false, message: "Credenciais incompletas para Growatt" };
      }
      
      // Simulação de validação com base no valor do username
      if (username.value.toLowerCase().includes('test')) {
        return { isValid: true, message: "Credenciais Growatt validadas com sucesso" };
      } else {
        return { isValid: false, message: "Falha na validação com Growatt (simulado)" };
      }
    } 
    else if (fabricanteId === 'fab_saj') {
      // Simulando validação para SAJ
      const apiKey = credenciaisSeguras['api_key'] as { value: string, iv?: string, sensitive: boolean };
      
      if (!apiKey || !apiKey.value) {
        return { isValid: false, message: "Credenciais incompletas para SAJ" };
      }
      
      // Simulação de validação com base no tamanho da chave
      if (apiKey.value.length > 8) {
        return { isValid: true, message: "Credenciais SAJ validadas com sucesso" };
      } else {
        return { isValid: false, message: "Falha na validação com SAJ (simulado)" };
      }
    }
    else {
      // Para outros fabricantes, simulamos sucesso por padrão
      return { isValid: true, message: "Credenciais validadas com sucesso (simulado)" };
    }
  } catch (error) {
    console.error("Erro ao validar credenciais:", error);
    return { isValid: false, message: `Erro ao validar: ${error instanceof Error ? error.message : 'Erro desconhecido'}` };
  }
}

// Função para configurar o cliente Supabase
function createSupabaseClient(token: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

// Função para verificar autenticação e obter usuário
async function authenticateUser(supabase: any, token: string) {
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    throw new Error('Não foi possível autenticar o usuário: ' + (error?.message || 'Usuário não encontrado'));
  }
  
  return user;
}

// Handler para listar credenciais do usuário
async function handleListCredentials(req: Request, user: any, supabase: any) {
  const url = new URL(req.url);
  const fabricanteId = url.searchParams.get('fabricante_id');
  
  let query = supabase
    .from('credenciais_servico_usuario')
    .select(`
      id,
      fabricante_id,
      fabricante:fabricantes_equipamentos(nome),
      nome_referencia,
      status_validacao,
      ultima_validacao_em,
      habilitado,
      created_at,
      updated_at
    `)
    .eq('user_id', user.id);
  
  // Filtrar por fabricante se especificado
  if (fabricanteId) {
    query = query.eq('fabricante_id', fabricanteId);
  }
  
  const { data, error } = await query.order('created_at', { ascending: false });
  
  if (error) {
    throw new Error(`Erro ao buscar credenciais: ${error.message}`);
  }
  
  // Formatar dados para resposta
  const formattedData = data.map(item => ({
    id: item.id,
    fabricante_id: item.fabricante_id,
    fabricante_nome: item.fabricante?.nome || 'Desconhecido',
    nome_referencia: item.nome_referencia,
    status_validacao: item.status_validacao,
    ultima_validacao_em: item.ultima_validacao_em,
    habilitado: item.habilitado,
    created_at: item.created_at,
    updated_at: item.updated_at
  }));
  
  return {
    success: true,
    message: 'Credenciais obtidas com sucesso',
    data: formattedData
  };
}

// Handler para obter uma credencial específica
async function handleGetCredential(req: Request, user: any, supabase: any) {
  const url = new URL(req.url);
  const parts = url.pathname.split('/');
  const credentialId = parts[parts.length - 1];
  
  if (!credentialId) {
    throw new Error('ID da credencial não especificado');
  }
  
  const { data, error } = await supabase
    .from('credenciais_servico_usuario')
    .select(`
      id,
      fabricante_id,
      fabricante:fabricantes_equipamentos(nome, api_config_schema),
      nome_referencia,
      status_validacao,
      ultima_validacao_em,
      habilitado,
      created_at,
      updated_at
    `)
    .eq('id', credentialId)
    .eq('user_id', user.id)
    .single();
  
  if (error) {
    throw new Error(`Erro ao buscar credencial: ${error.message}`);
  }
  
  if (!data) {
    throw new Error('Credencial não encontrada');
  }
  
  // Formatar dados para resposta
  const formattedData = {
    id: data.id,
    fabricante_id: data.fabricante_id,
    fabricante_nome: data.fabricante?.nome || 'Desconhecido',
    api_config_schema: data.fabricante?.api_config_schema || null,
    nome_referencia: data.nome_referencia,
    status_validacao: data.status_validacao,
    ultima_validacao_em: data.ultima_validacao_em,
    habilitado: data.habilitado,
    created_at: data.created_at,
    updated_at: data.updated_at
  };
  
  return {
    success: true,
    message: 'Credencial obtida com sucesso',
    data: formattedData
  };
}

// Handler para deletar uma credencial
async function handleDeleteCredential(req: Request, user: any, supabase: any) {
  const url = new URL(req.url);
  const parts = url.pathname.split('/');
  const credentialId = parts[parts.length - 1];
  
  if (!credentialId) {
    throw new Error('ID da credencial não especificado');
  }
  
  // Verificar se a credencial pertence ao usuário
  const { data: existingCredential, error: findError } = await supabase
    .from('credenciais_servico_usuario')
    .select('id')
    .eq('id', credentialId)
    .eq('user_id', user.id)
    .maybeSingle();
  
  if (findError) {
    throw new Error(`Erro ao verificar credencial: ${findError.message}`);
  }
  
  if (!existingCredential) {
    throw new Error('Credencial não encontrada ou não pertence ao usuário');
  }
  
  // Excluir a credencial
  const { error: deleteError } = await supabase
    .from('credenciais_servico_usuario')
    .delete()
    .eq('id', credentialId);
  
  if (deleteError) {
    throw new Error(`Erro ao excluir credencial: ${deleteError.message}`);
  }
  
  return {
    success: true,
    message: 'Credencial excluída com sucesso'
  };
}

// Handler para atualizar uma credencial
async function handleUpdateCredential(req: Request, user: any, supabase: any) {
  const url = new URL(req.url);
  const parts = url.pathname.split('/');
  const credentialId = parts[parts.length - 1];
  
  if (!credentialId) {
    throw new Error('ID da credencial não especificado');
  }
  
  // Obter payload
  const payload = await req.json();
  
  // Verificar se a credencial pertence ao usuário
  const { data: existingCredential, error: findError } = await supabase
    .from('credenciais_servico_usuario')
    .select('id, fabricante_id')
    .eq('id', credentialId)
    .eq('user_id', user.id)
    .maybeSingle();
  
  if (findError) {
    throw new Error(`Erro ao verificar credencial: ${findError.message}`);
  }
  
  if (!existingCredential) {
    throw new Error('Credencial não encontrada ou não pertence ao usuário');
  }
  
  const updateData: Record<string, any> = {
    updated_at: new Date().toISOString()
  };
  
  // Adicionar campos atualizáveis
  if (payload.habilitado !== undefined) {
    updateData.habilitado = payload.habilitado;
  }
  
  if (payload.nome_referencia) {
    updateData.nome_referencia = payload.nome_referencia;
  }
  
  // Se tiver credenciais para atualizar, processar e atualizar
  if (payload.credenciais_objeto && Object.keys(payload.credenciais_objeto).length > 0) {
    // Obter informações do fabricante
    const { data: fabricante, error: fabricanteError } = await supabase
      .from('fabricantes_equipamentos')
      .select('id, nome, api_config_schema')
      .eq('id', existingCredential.fabricante_id)
      .single();
    
    if (fabricanteError || !fabricante) {
      throw new Error(`Erro ao buscar dados do fabricante: ${fabricanteError?.message || 'Fabricante não encontrado'}`);
    }
    
    // Obter credenciais existentes para mesclar
    const { data: currentCredential, error: credentialError } = await supabase
      .from('credenciais_servico_usuario')
      .select('credenciais_seguras')
      .eq('id', credentialId)
      .single();
    
    if (credentialError) {
      throw new Error(`Erro ao buscar credenciais atuais: ${credentialError.message}`);
    }
    
    // Obter chave mestra
    const masterKey = Deno.env.get('ENCRYPTION_MASTER_KEY') || 'uma_chave_mestra_segura_para_desenvolvimento';
    
    // Processar e criptografar as credenciais
    const apiConfigSchema: ApiConfigSchema = fabricante.api_config_schema as ApiConfigSchema;
    const credenciaisSeguras = { ...currentCredential.credenciais_seguras } as Record<string, unknown>;
    
    // Atualizar apenas os campos fornecidos
    for (const field of apiConfigSchema.fields) {
      const fieldName = field.name;
      const fieldValue = payload.credenciais_objeto[fieldName];
      
      // Se o campo tiver valor, atualizá-lo
      if (fieldValue !== undefined) {
        if (field.type === 'password' && fieldValue) {
          const { encrypted, iv } = await encryptSensitiveData(fieldValue, masterKey);
          credenciaisSeguras[fieldName] = {
            value: encrypted,
            iv: iv,
            sensitive: true
          };
        } else if (fieldValue) {
          credenciaisSeguras[fieldName] = {
            value: fieldValue,
            sensitive: false
          };
        }
      }
    }
    
    updateData.credenciais_seguras = credenciaisSeguras;
    
    // Revalidar as credenciais
    const validationResult = await validateCredentials(
      existingCredential.fabricante_id,
      credenciaisSeguras,
      masterKey
    );
    
    updateData.status_validacao = validationResult.isValid ? 'VALIDO' : 'INVALIDO';
    updateData.ultima_validacao_em = new Date().toISOString();
  }
  
  // Realizar a atualização
  const { data: updatedCredential, error: updateError } = await supabase
    .from('credenciais_servico_usuario')
    .update(updateData)
    .eq('id', credentialId)
    .select('id, status_validacao, ultima_validacao_em, nome_referencia, habilitado')
    .single();
  
  if (updateError) {
    throw new Error(`Erro ao atualizar credencial: ${updateError.message}`);
  }
  
  return {
    success: true,
    message: 'Credencial atualizada com sucesso',
    data: updatedCredential
  };
}

// Handler para revalidar credenciais
async function handleRevalidateCredential(req: Request, user: any, supabase: any) {
  const url = new URL(req.url);
  const parts = url.pathname.split('/');
  const credentialId = parts[parts.length - 2]; // Formato /credentials/:id/revalidate
  
  if (!credentialId) {
    throw new Error('ID da credencial não especificado');
  }
  
  // Verificar se a credencial pertence ao usuário
  const { data: credential, error: findError } = await supabase
    .from('credenciais_servico_usuario')
    .select('id, fabricante_id, credenciais_seguras')
    .eq('id', credentialId)
    .eq('user_id', user.id)
    .maybeSingle();
  
  if (findError) {
    throw new Error(`Erro ao verificar credencial: ${findError.message}`);
  }
  
  if (!credential) {
    throw new Error('Credencial não encontrada ou não pertence ao usuário');
  }
  
  // Obter chave mestra
  const masterKey = Deno.env.get('ENCRYPTION_MASTER_KEY') || 'uma_chave_mestra_segura_para_desenvolvimento';
  
  // Revalidar as credenciais
  const validationResult = await validateCredentials(
    credential.fabricante_id,
    credential.credenciais_seguras,
    masterKey
  );
  
  const now = new Date().toISOString();
  
  // Atualizar status
  const { data: updatedCredential, error: updateError } = await supabase
    .from('credenciais_servico_usuario')
    .update({
      status_validacao: validationResult.isValid ? 'VALIDO' : 'INVALIDO',
      ultima_validacao_em: now,
      updated_at: now
    })
    .eq('id', credentialId)
    .select('id, status_validacao, ultima_validacao_em, nome_referencia')
    .single();
  
  if (updateError) {
    throw new Error(`Erro ao atualizar status da credencial: ${updateError.message}`);
  }
  
  return {
    success: true,
    message: validationResult.isValid ? 'Credenciais validadas com sucesso' : 'Falha na validação das credenciais',
    data: {
      ...updatedCredential,
      validation_message: validationResult.message
    }
  };
}

// Handler para criar/salvar credenciais (POST)
async function handleCreateCredential(req: Request, user: any, supabase: any) {
  // Obter payload do corpo da requisição
  const payload: CredentialPayload = await req.json();
  
  // Validar payload
  if (!payload.fabricante_id || !payload.credenciais_objeto) {
    throw new Error('Dados incompletos. Fabricante e credenciais são obrigatórios.');
  }
  
  // Buscar informações do fabricante para validar as credenciais
  const { data: fabricante, error: fabricanteError } = await supabase
    .from('fabricantes_equipamentos')
    .select('id, nome, api_config_schema')
    .eq('id', payload.fabricante_id)
    .single();
  
  if (fabricanteError || !fabricante) {
    throw new Error(`Fabricante não encontrado: ${fabricanteError?.message || ''}`);
  }
  
  // Obter chave mestra do Vault do Supabase
  const masterKey = Deno.env.get('ENCRYPTION_MASTER_KEY') || 'uma_chave_mestra_segura_para_desenvolvimento';
  
  // Processar e criptografar as credenciais
  const apiConfigSchema: ApiConfigSchema = fabricante.api_config_schema as ApiConfigSchema;
  const credenciaisSeguras: Record<string, unknown> = {};
  
  // Para cada campo no schema da API
  for (const field of apiConfigSchema.fields) {
    const fieldName = field.name;
    const fieldValue = payload.credenciais_objeto[fieldName];
    
    if (field.required && !fieldValue) {
      throw new Error(`Campo obrigatório não fornecido: ${field.label}`);
    }
    
    // Se o campo for sensível (password), criptografar
    if (field.type === 'password' && fieldValue) {
      const { encrypted, iv } = await encryptSensitiveData(fieldValue, masterKey);
      credenciaisSeguras[fieldName] = {
        value: encrypted,
        iv: iv,
        sensitive: true
      };
    } else if (fieldValue) {
      // Outros campos são armazenados como texto simples
      credenciaisSeguras[fieldName] = {
        value: fieldValue,
        sensitive: false
      };
    }
  }
  
  // Verificar se já existe um registro para este usuário e fabricante
  const { data: existingCredential } = await supabase
    .from('credenciais_servico_usuario')
    .select('id')
    .eq('user_id', user.id)
    .eq('fabricante_id', payload.fabricante_id)
    .maybeSingle();
  
  // Data atual
  const now = new Date().toISOString();
  
  let result;
  
  // Validar as credenciais
  const validationResult = await validateCredentials(
    payload.fabricante_id,
    credenciaisSeguras,
    masterKey
  );
  
  // Dados para inserção/atualização
  const credentialData = {
    user_id: user.id,
    fabricante_id: payload.fabricante_id,
    credenciais_seguras: credenciaisSeguras,
    nome_referencia: payload.nome_referencia || `${fabricante.nome} API`,
    status_validacao: validationResult.isValid ? 'VALIDO' : 'INVALIDO',
    ultima_validacao_em: now,
    updated_at: now,
    habilitado: true
  };
  
  // Atualizar ou inserir as credenciais
  if (existingCredential?.id) {
    // Atualizar credencial existente
    const { data, error } = await supabase
      .from('credenciais_servico_usuario')
      .update(credentialData)
      .eq('id', existingCredential.id)
      .select('id, status_validacao, ultima_validacao_em, nome_referencia')
      .single();
      
    if (error) {
      throw new Error(`Erro ao atualizar credenciais: ${error.message}`);
    }
    
    result = data;
  } else {
    // Inserir nova credencial
    const { data, error } = await supabase
      .from('credenciais_servico_usuario')
      .insert({
        ...credentialData,
        created_at: now
      })
      .select('id, status_validacao, ultima_validacao_em, nome_referencia')
      .single();
      
    if (error) {
      throw new Error(`Erro ao inserir credenciais: ${error.message}`);
    }
    
    result = data;
  }
  
  // Retornar resposta de sucesso
  return {
    success: true,
    message: existingCredential?.id 
      ? 'Credenciais atualizadas com sucesso' 
      : 'Credenciais registradas com sucesso',
    data: {
      id: result.id,
      status: result.status_validacao,
      validated_at: result.ultima_validacao_em,
      nome_referencia: result.nome_referencia
    }
  };
}

// Handler principal
serve(async (req) => {
  // Lidar com requisições OPTIONS para CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    // Recuperar e verificar token JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, message: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const token = authHeader.replace('Bearer ', '');
    const supabase = createSupabaseClient(token);
    
    // Autenticar usuário
    let user;
    try {
      user = await authenticateUser(supabase, token);
    } catch (authError) {
      return new Response(
        JSON.stringify({ success: false, message: authError instanceof Error ? authError.message : 'Erro de autenticação' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const url = new URL(req.url);
    const path = url.pathname;
    let response: ApiResponse;
    
    // Roteamento baseado no método HTTP e path
    if (req.method === 'GET') {
      if (path.match(/\/credentials\/\w+\/revalidate$/)) {
        // GET /credentials/:id/revalidate
        response = await handleRevalidateCredential(req, user, supabase);
      } else if (path.match(/\/credentials\/\w+$/)) {
        // GET /credentials/:id
        response = await handleGetCredential(req, user, supabase);
      } else {
        // GET /credentials
        response = await handleListCredentials(req, user, supabase);
      }
    } 
    else if (req.method === 'POST') {
      // POST /credentials
      response = await handleCreateCredential(req, user, supabase);
    } 
    else if (req.method === 'DELETE' && path.match(/\/credentials\/\w+$/)) {
      // DELETE /credentials/:id
      response = await handleDeleteCredential(req, user, supabase);
    } 
    else if ((req.method === 'PUT' || req.method === 'PATCH') && path.match(/\/credentials\/\w+$/)) {
      // PUT or PATCH /credentials/:id
      response = await handleUpdateCredential(req, user, supabase);
    } 
    else {
      return new Response(
        JSON.stringify({ success: false, message: 'Método ou rota não suportados' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Retornar resposta de sucesso
    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    // Tratamento de erros
    console.error("Erro no processamento da solicitação:", error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: 'Erro no processamento da solicitação', 
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}); 