import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';

interface PlantaParaImportar {
  fabricante_id: string;
  id_planta_fabricante: string; 
  nome_planta_fabricante: string;
  potencia_instalada_kwp?: number;
  localizacao_string?: string;
  dados_adicionais_fabricante?: Record<string, any>; 
}

interface ImportPayload {
  plantas: PlantaParaImportar[];
}

interface PlantaSolarInsert {
  proprietario_user_id: string;
  fabricante_id: string;
  id_externo_planta: string;
  nome: string; // nome da planta no sistema ModularOne, pode ser o nome_planta_fabricante inicialmente
  dados_importacao_api: Record<string, any>; // Onde armazenamos todos os dados brutos/originais
  // Outros campos da tabela plantas_solares podem ter defaults ou serem null
  apelido?: string;
  status_operacional?: string; // Ex: 'ATIVO', 'INATIVO', 'PENDENTE' - definir um enum default?
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Authorization header ausente/malformatado' }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      const detail = userError instanceof Error ? userError.message : String(userError);
      return new Response(JSON.stringify({ error: 'Falha na autenticação do usuário', detail }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 });
    }
    const userId = user.id;

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Método não permitido, esperado POST' }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 405 });
    }

    const payload = await req.json() as ImportPayload;
    if (!payload.plantas || !Array.isArray(payload.plantas) || payload.plantas.length === 0) {
      return new Response(JSON.stringify({ error: 'Payload inválido: "plantas" deve ser um array não vazio.' }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }

    const plantasParaInserir: PlantaSolarInsert[] = payload.plantas.map(p => ({
      proprietario_user_id: userId,
      fabricante_id: p.fabricante_id,
      id_externo_planta: p.id_planta_fabricante,
      nome: p.nome_planta_fabricante, // Usar o nome do fabricante como nome inicial
      // status_operacional: 'PENDENTE', // Default status?
      dados_importacao_api: {
        // Incluir todos os dados originais para referência e futura utilização
        id_planta_fabricante: p.id_planta_fabricante,
        nome_planta_fabricante: p.nome_planta_fabricante,
        potencia_instalada_kwp: p.potencia_instalada_kwp,
        localizacao_string: p.localizacao_string,
        dados_adicionais_fabricante: p.dados_adicionais_fabricante,
        data_importacao: new Date().toISOString(),
      },
    }));

    if (plantasParaInserir.length === 0) {
        return new Response(JSON.stringify({ message: 'Nenhuma planta válida para importar após o mapeamento.' }), 
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }); // Ou 400 se isso for um erro
    }

    // Usar upsert para evitar duplicatas e permitir atualização dos dados_importacao_api
    // A constraint UNIQUE deve ser (proprietario_user_id, fabricante_id, id_externo_planta)
    const { data, error } = await supabaseAdmin
      .from('plantas_solares')
      .upsert(plantasParaInserir, {
        onConflict: 'proprietario_user_id,fabricante_id,id_externo_planta',
        ignoreDuplicates: false, // Queremos que atualize os campos em conflito
      })
      .select('id, nome, fabricante_id, id_externo_planta'); // Retornar alguns dados das plantas importadas/atualizadas

    if (error) {
      console.error('Erro ao importar plantas:', error);
      // Checar por erros específicos, se necessário (ex: violação de FK em fabricante_id)
      return new Response(JSON.stringify({ error: 'Erro ao salvar plantas no banco de dados.', detail: error.message }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
    }

    return new Response(JSON.stringify({ success: true, message: `${data?.length || 0} plantas importadas/atualizadas com sucesso.`, data }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'Erro desconhecido';
    const errorStack = e instanceof Error ? e.stack : 'Stack não disponível';
    console.error(`Erro em import-selected-plants: ${errorMessage}`, errorStack);
    return new Response(JSON.stringify({ error: 'Erro interno do servidor.', detail: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
}); 