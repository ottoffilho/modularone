import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'; // Assumindo que temos um cliente admin compartilhado
// import { ietiesClient } from '../_shared/ietiesClient.ts'; // Comentado por enquanto - Vault/Decryption TBD
import { getCryptoKey, decryptValue } from '../_shared/crypto.ts'; // Importar funções de crypto.ts
import md5 from 'npm:js-md5@0.8.3'; // Importar js-md5 para gerar hash MD5

// Definição da interface para a planta externa padronizada
interface PlantaExternaPadronizada {
  id_planta_fabricante: string;
  nome_planta_fabricante: string;
  potencia_instalada_kwp?: number;
  localizacao_string?: string;
  dados_adicionais_fabricante?: Record<string, any>; // Para outros dados úteis
}

// Interface para o input da função
interface FunctionInput {
  fabricante_id: string;
}

serve(async (req: Request) => {
  // Tratar requisição OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Autenticação do Usuário ModularOne e obtenção do user_id
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization header missing' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      const detail = userError instanceof Error ? userError.message : String(userError);
      return new Response(JSON.stringify({ error: 'Failed to authenticate user', detail }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }
    const userId = user.id;

    // Validar o corpo da requisição
    if (req.method !== 'POST') { // A especificação do prompt parece implicar POST para input, mas GET é mais comum para "get list"
                                // No entanto, o prompt B.3. UI Passo 2 diz "Chamar ... com o selectedFabricanteId",
                                // o que sugere que o fabricante_id pode ser parte da URL (se fosse GET com Deno.serve router)
                                // ou no body se for POST. Dado que o prompt A diz "Input Esperado (do frontend): { fabricante_id: string }",
                                // POST com JSON body é o mais direto para supabase.functions.invoke.
      return new Response(JSON.stringify({ error: 'Method not allowed, expected POST' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405,
      });
    }

    const { fabricante_id } = (await req.json()) as FunctionInput;

    if (!fabricante_id) {
      return new Response(JSON.stringify({ error: 'Missing fabricante_id in request body' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    console.log(`User ${userId} requested plant list for fabricante_id: ${fabricante_id}`);

    // 2. Buscar Configurações do Fabricante (incluindo schema para descriptografia)
    const { data: fabricanteApiData, error: fabricanteApiError } = await supabaseAdmin
      .from('fabricantes_equipamentos') // Corrigido: usa a tabela correta conforme a migração
      .select('nome, identificador_api, api_config_schema')
      .eq('id', fabricante_id)
      .single();

    if (fabricanteApiError || !fabricanteApiData) {
      const detail = fabricanteApiError instanceof Error ? fabricanteApiError.message : String(fabricanteApiError);
      return new Response(JSON.stringify({ error: 'Configuração do fabricante não encontrada ou erro.', detail }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }
    
    // O identificador_api pode ser algo como 'GROWATT_API', 'SAJ_API', etc.
    // Ou usar o nome se for estável: fabricanteApiData.nome
    const fabricanteIdentifier = fabricanteApiData.identificador_api || fabricanteApiData.nome?.toUpperCase().replace(/\s+/g, '_'); 

    // Buscar Credenciais do Usuário para este fabricante
    const { data: credencialEntry, error: credencialError } = await supabaseAdmin
      .from('credenciais_servico_usuario') // Tabela correta, como definido
      .select('id, credenciais_seguras') // credenciais_seguras é o campo criptografado.
      .eq('user_id', userId)
      .eq('fabricante_id', fabricante_id)
      .single();

    if (credencialError || !credencialEntry) {
      const detail = credencialError instanceof Error ? credencialError.message : 'No valid credentials for this manufacturer';
      return new Response(JSON.stringify({ error: 'Credenciais válidas não encontradas.', detail }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404, // ou 400 se a ausência de credenciais é um bad request
      });
    }

    // 3. Descriptografar Credenciais
    let decryptedCredentials: Record<string, string> = {};
    let cryptoKey: CryptoKey; // Definir cryptoKey aqui

    try {
      cryptoKey = await getCryptoKey(); // Obter a chave uma vez

      const rawCredentials = credencialEntry.credenciais_seguras as Record<string, any>; 
      if (typeof rawCredentials !== 'object' || rawCredentials === null) {
        throw new Error('Formato de credenciais_seguras inválido/nulo do DB.');
      }

      const configSchema = fabricanteApiData.api_config_schema as { fields?: Array<{ name: string; type?: string; encrypt?: boolean }> } | null;
      
      if (!configSchema || !configSchema.fields || !Array.isArray(configSchema.fields)) {
        throw new Error ('api_config_schema do fabricante (da tabela fabricantes_api) está ausente ou malformado.');
      }

      for (const fieldConfig of configSchema.fields) {
        const fieldName = fieldConfig.name;
        const encryptedFieldData = rawCredentials[fieldName];

        if (encryptedFieldData === undefined || encryptedFieldData === null) continue;

        if (fieldConfig.encrypt === true || fieldConfig.type === 'password') {
          if (typeof encryptedFieldData !== 'object' || !encryptedFieldData.iv_hex || !encryptedFieldData.ciphertext_hex) {
            console.warn(`Campo ${fieldName} marcado para descriptografia, mas não está no formato {iv_hex, ciphertext_hex}.`);
            if(typeof encryptedFieldData === 'string') decryptedCredentials[fieldName] = encryptedFieldData;
            else throw new Error(`Formato de criptografia inválido para o campo ${fieldName}. Esperado objeto {iv_hex, ciphertext_hex}.`);
            continue;
          }
          // Usar a função decryptValue importada
          decryptedCredentials[fieldName] = await decryptValue(encryptedFieldData.iv_hex, encryptedFieldData.ciphertext_hex, cryptoKey);
        } else {
          decryptedCredentials[fieldName] = String(encryptedFieldData);
        }
      }

      if (Object.keys(decryptedCredentials).length === 0 && Object.keys(rawCredentials).length > 0) {
         // Isso pode ser um problema se esperávamos campos descriptografados
         console.warn('Nenhum campo foi efetivamente descriptografado ou mapeado, verifique o schema e os dados.');
      }
      console.log('Processamento de credenciais concluído para get-external-plant-list.');

    } catch (processingError: unknown) {
      const err = processingError instanceof Error ? processingError : new Error(String(processingError));
      console.error('Erro no processamento/descriptografia de credenciais em get-external-plant-list:', err.message, err.stack);
      return new Response(JSON.stringify({ error: 'Falha ao processar credenciais de serviço.', detail: err.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // 5. Dispatcher (Lógica Específica do Fabricante)
    let externalPlants: PlantaExternaPadronizada[] = [];

    switch (fabricanteIdentifier) {
      case 'GROWATT_API': 
      case 'GROWATT': 
        try {
          // Lógica da API Growatt
          // Verificar diferentes possibilidades de nomes dos campos para maior resiliência
          // e logar informações úteis para diagnóstico
          console.log('Campos disponíveis nas credenciais descriptografadas:', Object.keys(decryptedCredentials).join(', '));
          
          let growattUsername = decryptedCredentials.username; 
          let growattPassword = decryptedCredentials.password;
          
          // Tentar variações de nome de usuário se o campo principal não estiver presente
          if (!growattUsername) {
            if (decryptedCredentials.username_growatt) {
              growattUsername = decryptedCredentials.username_growatt;
              console.log('Usando campo alternativo username_growatt em vez de username');
            } else if (decryptedCredentials.account) {
              growattUsername = decryptedCredentials.account;
              console.log('Usando campo alternativo account em vez de username');
            }
          }
          
          // Tentar variações de senha se o campo principal não estiver presente
          if (!growattPassword) {
            if (decryptedCredentials.password_growatt) {
              growattPassword = decryptedCredentials.password_growatt;
              console.log('Usando campo alternativo password_growatt em vez de password');
            }
          }

          if (!growattUsername || !growattPassword) {
            // Log detalhado dos campos disponíveis para diagnóstico (sem mostrar valores sensíveis)
            const availableFields = Object.keys(decryptedCredentials);
            console.error(`Credenciais Growatt ausentes ou incompletas. Campos disponíveis: ${availableFields.join(', ')}`);
            throw new Error('Credenciais Growatt (username/password) ausentes ou incompletas após descriptografia. ' +
                           'Verifique se as credenciais foram configuradas corretamente na página de integrações.');
          }
          
          // Gerar hash MD5 da senha usando js-md5
          const hashedPassword = md5(growattPassword);

          console.log(`Tentando login na API Growatt para usuário: ${growattUsername} (senha foi hasheada com MD5)`);
          
          const loginPayload = { account: growattUsername, password: hashedPassword };
          console.log('Payload de login Growatt:', JSON.stringify({ account: growattUsername, password: '[MD5_HASHED]' }));

          const loginResponse = await fetch('https://openapi.growatt.com/v1/user/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(loginPayload),
          });

          const loginResponseText = await loginResponse.text();
          console.log('Resposta do login Growatt - Status:', loginResponse.status);
          
          // Tentar fazer parse do JSON, mas tratar com cuidado caso não seja um JSON válido
          let loginData;
          try {
            loginData = JSON.parse(loginResponseText);
            console.log('Detalhes da resposta do login Growatt:', JSON.stringify({
              error_code: loginData.error_code,
              error_msg: loginData.error_msg,
              has_data: !!loginData.data,
              status_code: loginResponse.status
            }));
          } catch (jsonError) {
            console.error('Falha ao analisar resposta do login Growatt como JSON:', loginResponseText);
            throw new Error(`Resposta da API Growatt não é um JSON válido: ${loginResponseText}`);
          }

          // Verificar especificamente o erro 10011 (permission_denied) para dar instruções claras
          if (loginData.error_code === 10011) {
            console.error(`Falha no login Growatt - Erro permission_denied (10011): ${loginData.error_msg}`);
            throw new Error(`Acesso negado à API Growatt (Código 10011). Verifique se: 
            1. O nome de usuário e senha estão corretos
            2. A conta Growatt tem permissão para acesso via API
            3. Se necessário, entre em contato com o suporte da Growatt para ativar o acesso à API para sua conta`);
          }
          
          if (!loginResponse.ok || loginData.error_code !== 0) {
            console.error(`Falha no login Growatt - Código: ${loginData.error_code}, Mensagem: ${loginData.error_msg}`);
            throw new Error(`Falha no login com a API Growatt: ${loginData.error_msg || loginResponse.statusText} (Código ${loginData.error_code || loginResponse.status})`);
          }
          
          const accessToken = loginData.data?.access_token;

          if (!accessToken) {
            console.error('Growatt login response missing access token:', loginData);
            throw new Error('Token de acesso não retornado pela API Growatt após login.');
          }
          console.log('Growatt login successful, accessToken obtained.');

          // B. Chamar o endpoint de listagem de plantas
          // Endpoint: 'https://openapi.growatt.com/v1/plant/list'
          // Header: 'token: Bearer <accessToken>' (ou como a API Growatt esperar)
          // O SDK Python antigo usava POST com sessionKey no corpo.
          // A API pública v1 /plant/list é GET e usa 'Authorization: Bearer <token>'
          
          const plantListUrl = 'https://openapi.growatt.com/v1/plant/list';
          console.log(`Fetching Growatt plant list from: ${plantListUrl}`);
          
          const plantListResponse = await fetch(plantListUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          });

          const plantListResponseText = await plantListResponse.text();
          console.log('Growatt plant list response status:', plantListResponse.status);
          
          let plantListData;
          try {
            plantListData = JSON.parse(plantListResponseText);
          } catch (jsonError) {
            console.error('Failed to parse Growatt plant list response as JSON:', plantListResponseText);
            throw new Error(`Resposta da lista de plantas da Growatt não é um JSON válido: ${plantListResponseText}`);
          }

          if (!plantListResponse.ok) {
            console.error('Growatt get plant list failed:', plantListResponse.status, plantListResponseText);
            throw new Error(`Falha ao buscar lista de plantas da Growatt: ${plantListResponse.status} - ${plantListResponseText}`);
          }

          // A resposta da Growatt para /plant/list é: { "data": [{ "plant_id": "...", "plant_name": "...", "country": "...", "city": "...", "create_date": "...", "nominal_power": "...", ... }], "error_code": 0, "error_message": "None" }
          // ou { "data": { "plants": [...] } } para outras versões.
          // Verificar o formato exato da resposta que você está usando.

          if (plantListData.error_code !== 0 && plantListData.error_code !== null) { // Algumas APIs retornam null para sucesso
             console.error('Growatt API error for plant list:', plantListData);
             throw new Error(`Erro da API Growatt ao listar plantas: ${plantListData.error_message || 'Unknown API error'} (Code: ${plantListData.error_code})`);
          }

          // Lidar com diferentes formatos de resposta possíveis
          let rawPlants = plantListData.data; // Assumindo que data é um array [{plant_id, plant_name, ...}]
          
          // Verificar se a resposta usa o formato aninhado { data: { plants: [...] } }
          if (!Array.isArray(rawPlants) && rawPlants?.plants && Array.isArray(rawPlants.plants)) {
            rawPlants = rawPlants.plants;
            console.log('Usando formato aninhado da resposta Growatt (data.plants)');
          }
          
          if (!Array.isArray(rawPlants)) {
            console.error('Growatt plant list data is not an array:', rawPlants);
            throw new Error('Formato inesperado da lista de plantas da Growatt (esperava um array).');
          }
          console.log(`Growatt returned ${rawPlants.length} plants.`);
          
          externalPlants = rawPlants.map((plant: any) => {
            const potenciaEmWatts = plant.nominal_power ? parseFloat(plant.nominal_power) : 0;
            return {
              id_planta_fabricante: String(plant.plant_id),
              nome_planta_fabricante: plant.plant_name,
              potencia_instalada_kwp: potenciaEmWatts ? potenciaEmWatts / 1000 : undefined,
              localizacao_string: `${plant.city || ''}, ${plant.country || ''}`.replace(/^, |, $|^, $/, '').trim() || undefined,
              dados_adicionais_fabricante: {
                create_date_api: plant.create_date,
                // Adicionar outros campos da Growatt aqui se necessário para referência futura
              }
            };
          });

        } catch (apiError: unknown) {
          const err = apiError instanceof Error ? apiError : new Error(String(apiError));
          console.error('Growatt API interaction error:', err.message, err.stack);
          return new Response(JSON.stringify({ error: 'Erro ao interagir com a API da Growatt.', detail: err.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 502, // Bad Gateway ou similar
          });
        }
        break;
      
      // case 'SAJ_API':
      //   // Lógica para SAJ
      //   break;

      default:
        return new Response(JSON.stringify({ error: `Fabricante '${fabricanteIdentifier}' não suportado para importação.` }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
    }

    return new Response(JSON.stringify(externalPlants), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('General error in get-external-plant-list:', err.message, err.stack);
    const isCryptoConfigError = err.message.includes("criptografia") || err.message.includes("Chave") || err.message.includes("KEY");
    return new Response(JSON.stringify({
        error: isCryptoConfigError ? 'Erro config interna.' : 'Erro interno na função.',
        detail: isCryptoConfigError ? 'Omitido por segurança' : err.message
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
}); 