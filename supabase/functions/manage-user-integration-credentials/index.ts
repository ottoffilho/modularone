// Edge Function para gerenciar credenciais de integração do usuário
// Esta função recebe credenciais do usuário, criptografa dados sensíveis e os armazena no banco de dados

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
// import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"; // Não é necessário se usando supabaseAdmin
import { corsHeaders } from '../_shared/cors.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { getCryptoKey, encryptValue, decryptValue } from '../_shared/crypto.ts'; // Importar funções de crypto.ts
import md5 from 'npm:js-md5@0.8.3';

// Interface para o payload recebido ao criar/atualizar
interface CredentialUpsertPayload {
  fabricante_id: string;
  credenciais_campos: Record<string, string>; // Campos vêm como strings do formulário
  nome_referencia?: string;
  // id?: string; // Para atualizações, o ID virá na URL
}

// Interface para a configuração da API do fabricante (obtida de fabricantes_api.api_config_schema)
interface ApiConfigField {
  name: string;
  label: string; // Usado no frontend
  type: string;  // ex: 'text', 'password'
  required?: boolean;
  placeholder?: string;
  encrypt?: boolean; // Indica se o campo deve ser criptografado
}

interface ApiConfigSchema {
  fields: ApiConfigField[];
}

// Função para validar credenciais com a API do fabricante
async function validateCredentialsWithManufacturer(
  apiIdentifier: string | null | undefined, 
  decryptedCredentials: Record<string, string>
): Promise<{ isValid: boolean; message: string, validationTimestamp?: string }> {
  console.log(`Validando credenciais para ${apiIdentifier || 'fabricante desconhecido'}.`);
  
  // Normalizar o identificador para comparação
  const normalizedIdentifier = (apiIdentifier || '').toUpperCase().replace(/\s+/g, '_');
  
  // Validação específica para Growatt
  if (normalizedIdentifier === 'GROWATT' || normalizedIdentifier === 'GROWATT_API') {
    try {
      console.log('Campos disponíveis nas credenciais para validação:', Object.keys(decryptedCredentials).join(', '));
      
      // Obter as credenciais necessárias
      const username = decryptedCredentials.username || decryptedCredentials.username_growatt || decryptedCredentials.account;
      const password = decryptedCredentials.password || decryptedCredentials.password_growatt;
      
      if (!username || !password) {
        return {
          isValid: false,
          message: "Credenciais Growatt incompletas. Verifique se forneceu usuário e senha.",
          validationTimestamp: new Date().toISOString()
        };
      }
      
      // Gerar hash MD5 da senha usando js-md5
      const hashedPassword = md5(password);
      
      // Tentar fazer login na API Growatt
      console.log(`Tentando login de validação na API Growatt para usuário: ${username} (senha hasheada com MD5)`);
      const loginResponse = await fetch('https://openapi.growatt.com/v1/user/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account: username, password: hashedPassword })
      });
      
      const loginResponseText = await loginResponse.text();
      console.log('Resposta da validação Growatt - Status:', loginResponse.status);
      
      let loginData;
      
      try {
        loginData = JSON.parse(loginResponseText);
        console.log('Detalhes da resposta da validação Growatt:', JSON.stringify({
          statusCode: loginResponse.status,
          error_code: loginData.error_code,
          error_msg: loginData.error_msg,
          has_token: !!loginData.data?.access_token
        }));
      } catch (jsonError) {
        console.error('Erro ao analisar resposta da API Growatt para validação:', loginResponseText);
        return {
          isValid: false,
          message: `Erro ao validar credenciais: resposta inválida da API Growatt`,
          validationTimestamp: new Date().toISOString()
        };
      }
      
      // Verificar o código de erro específico 10011 (permissão negada)
      if (loginData.error_code === 10011) {
        return {
          isValid: false,
          message: `Acesso negado à API Growatt (Código 10011). Verifique se: 1) As credenciais estão corretas, 2) A conta tem permissão para API, 3) Entre em contato com o suporte Growatt se necessário.`,
          validationTimestamp: new Date().toISOString()
        };
      }
      
      // Verificar se o login foi bem-sucedido (error_code 0 indica sucesso)
      if (loginData.error_code === 0 && loginData.data?.access_token) {
        return {
          isValid: true,
          message: "Credenciais Growatt validadas com sucesso.",
          validationTimestamp: new Date().toISOString()
        };
      } else {
        return {
          isValid: false,
          message: `Falha na validação das credenciais Growatt: ${loginData.error_msg || 'Erro desconhecido'} (Código ${loginData.error_code || 'N/A'})`,
          validationTimestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Erro durante validação Growatt:`, errorMessage);
      
      return {
        isValid: false,
        message: `Erro ao validar credenciais Growatt: ${errorMessage}`,
        validationTimestamp: new Date().toISOString()
      };
    }
  }
  
  // Para outros fabricantes, implementar validação específica
  // Por enquanto, retornar simulação para fabricantes não implementados
  return {
    isValid: true, 
    message: `Validação com ${apiIdentifier || 'fabricante desconhecido'} não implementada completamente (aprovação simulada).`,
    validationTimestamp: new Date().toISOString(),
  };
}

// Handler principal que roteia baseado no método HTTP
serve(async (req: Request) => {
  console.log(`[manage-user-integration-credentials] Received request: ${req.method} ${req.url}`); // LOG ADICIONAL

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  let user: any = null;
  let cryptoKey: CryptoKey;

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Authorization header ausente/malformatado' }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');
    
    const { data: { user:authUser }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !authUser) {
      const detail = userError instanceof Error ? userError.message : String(userError); // Handle userError type
      return new Response(JSON.stringify({ error: 'Falha na autenticação do usuário', detail }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 });
    }
    user = authUser;
    cryptoKey = await getCryptoKey();

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(p => p);
    const functionNameFromPath = pathParts.find(p => p === 'manage-user-integration-credentials');
    let credentialId: string | null = null;
    if (pathParts.length > 0 && pathParts[pathParts.length -1] !== functionNameFromPath) {
        const potentialId = pathParts[pathParts.length -1];
        if (potentialId.match(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/)) {
            credentialId = potentialId;
        }
    }

    console.log(`[${req.method}] ${url.pathname} (Function: ${functionNameFromPath}, ID: ${credentialId || 'N/A'}) - User: ${user.id}`);

    if (functionNameFromPath === 'manage-user-integration-credentials') {
      if (req.method === 'GET' && !credentialId) { // LISTAR TODAS
          const { data, error } = await supabaseAdmin
              .from('credenciais_servico_usuario')
              .select(`id, fabricante_id, fabricante:fabricantes_equipamentos(nome, identificador_api), nome_referencia, status_validacao, ultima_validacao_em, created_at, updated_at`)
              .eq('user_id', user.id)
              .order('created_at', { ascending: false });
          if (error) throw error;
          const responseData = data.map(item => {
              const fab = item.fabricante as { nome?: string, identificador_api?: string } | null;
              return {
                  id: item.id,
                  fabricante_id: item.fabricante_id,
                  fabricante_nome: fab?.nome || 'N/A',
                  fabricante_identificador_api: fab?.identificador_api,
                  nome_referencia: item.nome_referencia,
                  status_validacao: item.status_validacao,
                  ultima_validacao_em: item.ultima_validacao_em,
                  created_at: item.created_at,
                  updated_at: item.updated_at
              };
          });
          return new Response(JSON.stringify(responseData), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

      } else if (req.method === 'POST' && !credentialId) { // CRIAR NOVA
          const payload = await req.json() as CredentialUpsertPayload;
          if (!payload.fabricante_id || !payload.credenciais_campos) {
              return new Response(JSON.stringify({ error: 'Payload: fabricante_id e credenciais_campos obrigatórios' }), 
                  { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
          }
          const { data: fabricanteApi, error: faError } = await supabaseAdmin
              .from('fabricantes_equipamentos').select('api_config_schema, nome, identificador_api').eq('id', payload.fabricante_id).single();
          if (faError || !fabricanteApi) throw faError || new Error('Fabricante não encontrado ou config API ausente.');
          
          const schema = fabricanteApi.api_config_schema as ApiConfigSchema | null;
          if (!schema?.fields?.length) throw new Error('Schema de config da API do fabricante malformado/ausente.');

          const credenciaisSeguras: Record<string, any> = {};
          const decryptedForValidation: Record<string, string> = {};
          for (const fieldCfg of schema.fields) {
              const val = payload.credenciais_campos[fieldCfg.name];
              if (val === undefined || val === null) {
                  if (fieldCfg.required) throw new Error(`Campo obrigatório '${fieldCfg.name}' ausente.`);
                  continue; 
              }
              if (fieldCfg.encrypt || fieldCfg.type === 'password') {
                  const { iv_hex, ciphertext_hex } = await encryptValue(String(val), cryptoKey);
                  credenciaisSeguras[fieldCfg.name] = { iv_hex: iv_hex, ciphertext_hex: ciphertext_hex };
                  decryptedForValidation[fieldCfg.name] = String(val);
              } else {
                  credenciaisSeguras[fieldCfg.name] = String(val);
                  decryptedForValidation[fieldCfg.name] = String(val);
              }
          }
          const validationRes = await validateCredentialsWithManufacturer(fabricanteApi.identificador_api || fabricanteApi.nome, decryptedForValidation);
          const { data: newCred, error: insError } = await supabaseAdmin.from('credenciais_servico_usuario')
              .insert({ user_id: user.id, fabricante_id: payload.fabricante_id, credenciais_seguras: credenciaisSeguras, nome_referencia: payload.nome_referencia, status_validacao: validationRes.isValid ? 'VALIDO' : 'INVALIDO', ultima_validacao_em: validationRes.validationTimestamp || new Date().toISOString()})
              .select('id, status_validacao, ultima_validacao_em, nome_referencia').single();
          if (insError) {
              if (insError.code === '23505') return new Response(JSON.stringify({ error: 'Usuário já possui credenciais para este fabricante.'}), { headers: { ...corsHeaders, 'Content-Type':'application/json'}, status: 409});
              throw insError;
          }
          return new Response(JSON.stringify({ success: true, message: 'Credenciais salvas.' + validationRes.message, data: newCred }), 
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 201 });

      } else if (req.method === 'PUT' && credentialId) { // ATUALIZAR EXISTENTE
          const payload = await req.json() as Partial<CredentialUpsertPayload>; 
          if (!payload.credenciais_campos && payload.nome_referencia === undefined) {
              return new Response(JSON.stringify({ error: 'Payload: credenciais_campos ou nome_referencia obrigatórios' }), 
                  { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
          }
          const { data: existing, error: fetchErr } = await supabaseAdmin.from('credenciais_servico_usuario')
              .select('fabricante_id, credenciais_seguras, fab:fabricantes_equipamentos(api_config_schema, nome, identificador_api)')
              .eq('id', credentialId).eq('user_id', user.id).single();
          if (fetchErr || !existing) throw fetchErr || new Error('Credencial não encontrada ou não pertence ao usuário.');
          
          const fabData = existing.fab as { api_config_schema?: any, nome?: string, identificador_api?: string } | null;
          const schema = fabData?.api_config_schema as ApiConfigSchema | null;
          if (!schema?.fields?.length) throw new Error('Schema de config da API do fabricante (via credencial) malformado.');

          const currentCreds = existing.credenciais_seguras as Record<string, any> || {};
          const credsToUpdate: Record<string, any> = {};
          const decryptedForValidation: Record<string, string> = {};

          // Primeiro, descriptografar todos os campos existentes para validação (assumindo novo formato _hex)
          for (const fieldCfg of schema.fields) {
              const fieldName = fieldCfg.name;
              const currentEncryptedFieldData = currentCreds[fieldName];
              
              if (currentEncryptedFieldData !== undefined && currentEncryptedFieldData !== null) {
                  if ((fieldCfg.encrypt || fieldCfg.type === 'password') && 
                      typeof currentEncryptedFieldData === 'object' && 
                      currentEncryptedFieldData.iv_hex && currentEncryptedFieldData.ciphertext_hex) { // Checa por _hex
                      try { 
                          decryptedForValidation[fieldName] = await decryptValue(currentEncryptedFieldData.iv_hex, currentEncryptedFieldData.ciphertext_hex, cryptoKey); 
                      }
                      catch (decryptionError: unknown) { 
                          const decErrMessage = decryptionError instanceof Error ? decryptionError.message : String(decryptionError);
                          console.warn(`Falha ao descriptografar campo antigo ${fieldName} para validação: ${decErrMessage}. Pode ser formato antigo.`); 
                          // Se falhar, pode ser formato antigo. Para validação, podemos tentar popular com um placeholder ou notificar.
                          // Por agora, não adicionamos ao decryptedForValidation se falhar.
                      }
                  } else if (typeof currentEncryptedFieldData !== 'object') { // Campo não criptografado
                      decryptedForValidation[fieldName] = String(currentEncryptedFieldData);
                  }
              }
          }
          
          if (payload.credenciais_campos) {
              for (const fieldCfg of schema.fields) {
                  const fieldName = fieldCfg.name;
                  if (payload.credenciais_campos[fieldName] !== undefined) {
                      const rawValue = payload.credenciais_campos[fieldName];
                      if (fieldCfg.encrypt || fieldCfg.type === 'password') {
                          const { iv_hex, ciphertext_hex } = await encryptValue(String(rawValue), cryptoKey);
                          credsToUpdate[fieldName] = { iv_hex: iv_hex, ciphertext_hex: ciphertext_hex }; // Corrigido aqui
                          decryptedForValidation[fieldName] = String(rawValue); // Atualiza com o novo valor para validação
                      } else {
                          credsToUpdate[fieldName] = String(rawValue);
                          decryptedForValidation[fieldName] = String(rawValue); // Atualiza com o novo valor para validação
                      }
                  }
              }
          }
          
          const validationResUpdate = await validateCredentialsWithManufacturer(fabData?.identificador_api || fabData?.nome, decryptedForValidation);
          
          const dbUpdatePayload: any = {};
          if (Object.keys(credsToUpdate).length > 0) {
              dbUpdatePayload.credenciais_seguras = { ...currentCreds, ...credsToUpdate };
          }
          if (payload.nome_referencia !== undefined) {
              dbUpdatePayload.nome_referencia = payload.nome_referencia;
          }
          dbUpdatePayload.status_validacao = validationResUpdate.isValid ? 'VALIDO' : 'INVALIDO';
          dbUpdatePayload.ultima_validacao_em = validationResUpdate.validationTimestamp || new Date().toISOString();
          dbUpdatePayload.updated_at = new Date().toISOString();

          // Apenas atualiza se houver de fato dados de credenciais ou nome_referencia para mudar
          // A validação (status e ultima_validacao_em) e updated_at são sempre atualizados se a intenção é mudar algo.
          if (!payload.nome_referencia && Object.keys(credsToUpdate).length === 0) { 
             return new Response(JSON.stringify({ message: 'Nenhum campo de dados (nome_referencia ou credenciais) fornecido para atualização.', status_validacao: dbUpdatePayload.status_validacao }), 
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
          }

          const { data: updatedCred, error: updError } = await supabaseAdmin.from('credenciais_servico_usuario')
              .update(dbUpdatePayload).eq('id', credentialId).eq('user_id', user.id)
              .select('id, status_validacao, ultima_validacao_em, nome_referencia').single();
          if (updError) throw updError;
          return new Response(JSON.stringify({ success: true, message: 'Credenciais atualizadas.' + validationResUpdate.message, data: updatedCred }), 
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

      } else if (req.method === 'DELETE' && credentialId) { // DELETAR
          const { error: delError } = await supabaseAdmin.from('credenciais_servico_usuario')
              .delete().eq('id', credentialId).eq('user_id', user.id);
          if (delError) throw delError;
          return new Response(JSON.stringify({ success: true, message: 'Credencial deletada' }), 
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      } else {
        return new Response(JSON.stringify({ error: `Método ou endpoint não suportado: ${req.method} ${url.pathname}` }), 
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 });
      }
    } else {
        return new Response(JSON.stringify({ error: `Endpoint não encontrado para o caminho: ${url.pathname}. Função esperada: 'manage-user-integration-credentials'` }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 });
    }
  } catch (e: unknown) {
    const errorStack = e instanceof Error ? e.stack : 'Stack não disponível';
    const errorMessage = e instanceof Error ? e.message : String(e);
    console.error(`Erro em manage-user-integration-credentials: ${errorMessage}`, errorStack);
    const isCryptoConfigError = errorMessage.includes("criptografia") || errorMessage.includes("Chave") || errorMessage.includes("KEY");
    const errorPayload = { 
        error: isCryptoConfigError ? 'Erro de configuração interna do servidor.' : 'Erro interno do servidor',
        detail: isCryptoConfigError ? 'Detalhe omitido por segurança' : errorMessage 
    };
    return new Response(JSON.stringify(errorPayload), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});