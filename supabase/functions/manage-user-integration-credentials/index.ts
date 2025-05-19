// Edge Function para gerenciar credenciais de integração do usuário
// Esta função recebe credenciais do usuário, criptografa dados sensíveis e os armazena no banco de dados

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from '../_shared/cors.ts';
import * as crypto from "https://deno.land/std@0.168.0/crypto/mod.ts";

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
  data?: any;
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
  const keyBytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(key)
  );
  
  // Gerar vetor de inicialização (IV)
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Configurar chave criptográfica
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );
  
  // Criptografar dados
  const encodedData = new TextEncoder().encode(data);
  const encryptedData = await crypto.subtle.encrypt(
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

// Função para validar credenciais - versão básica/mock
// Em um ambiente de produção, isso deve realmente validar com a API do fabricante
async function validateCredentials(
  fabricanteId: string, 
  credenciaisSeguras: Record<string, any>,
  masterKey: string
): Promise<{ isValid: boolean; message: string }> {
  try {
    // Simulação simples de validação
    // Em produção, você descriptografaria as credenciais e as testaria com a API do fabricante
    
    if (fabricanteId && credenciaisSeguras) {
      // Simulando uma validação bem-sucedida
      return { isValid: true, message: "Credenciais validadas com sucesso" };
    }
    
    return { isValid: false, message: "Credenciais inválidas" };
  } catch (error) {
    console.error("Erro ao validar credenciais:", error);
    return { isValid: false, message: `Erro ao validar: ${error.message || 'Erro desconhecido'}` };
  }
}

// Handler principal
serve(async (req) => {
  // Lidar com requisições OPTIONS para CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    // Verificar se é um método POST
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ success: false, message: 'Método não permitido' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Recuperar e verificar token JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, message: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Extrair token
    const token = authHeader.replace('Bearer ', '');
    
    // Inicializar cliente Supabase com o token do usuário
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    
    // Verificar usuário autenticado
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Não foi possível autenticar o usuário', 
          error: userError?.message 
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Obter payload do corpo da requisição
    const payload: CredentialPayload = await req.json();
    
    // Validar payload
    if (!payload.fabricante_id || !payload.credenciais_objeto) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Dados incompletos. Fabricante e credenciais são obrigatórios.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Buscar informações do fabricante para validar as credenciais
    const { data: fabricante, error: fabricanteError } = await supabase
      .from('fabricantes_equipamentos')
      .select('id, nome, api_config_schema')
      .eq('id', payload.fabricante_id)
      .single();
    
    if (fabricanteError || !fabricante) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Fabricante não encontrado', 
          error: fabricanteError?.message 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Obter chave mestra do Vault do Supabase (em produção, usar o Vault real)
    // Na versão de demonstração, usamos uma chave fixa (NÃO FAÇA ISSO EM PRODUÇÃO!)
    const masterKey = Deno.env.get('ENCRYPTION_MASTER_KEY') || 'uma_chave_mestra_segura_para_desenvolvimento';
    
    // Processar e criptografar as credenciais
    const apiConfigSchema: ApiConfigSchema = fabricante.api_config_schema as ApiConfigSchema;
    const credenciaisSeguras: Record<string, any> = {};
    
    // Para cada campo no schema da API
    for (const field of apiConfigSchema.fields) {
      const fieldName = field.name;
      const fieldValue = payload.credenciais_objeto[fieldName];
      
      if (field.required && !fieldValue) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: `Campo obrigatório não fornecido: ${field.label}` 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
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
    
    // Validar as credenciais (mock)
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
      updated_at: now
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
    const response: ApiResponse = {
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
        error: error.message || 'Erro desconhecido'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}); 