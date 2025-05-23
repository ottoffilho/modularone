import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

console.log("Função listar-plantas-solares inicializada.");

serve(async (req: Request) => {
  // Habilitar CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Criar cliente Supabase e autenticar usuário
    const supabaseAdminClient: SupabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Verificar se o usuário está autenticado
    const { data: { user }, error: userError } = await supabaseAdminClient.auth.getUser();

    if (userError || !user) {
      console.error("Erro ao buscar usuário ou usuário não autenticado:", userError);
      return new Response(JSON.stringify({ error: "Não autorizado", details: userError?.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }
    
    // Obter parâmetros da URL para filtragem
    const url = new URL(req.url);
    const fabricanteInversor = url.searchParams.get("fabricante_inversor");
    const credencialId = url.searchParams.get("credencial_id");
    const comIntegracao = url.searchParams.get("com_integracao") === "true";
    const status = url.searchParams.get("status");
    
    // Construir a consulta base
    let query = supabaseAdminClient
      .from('plantas_solares')
      .select(`
        *,
        credenciais_servico_usuario (
          id,
          nome_referencia,
          status_validacao
        )
      `)
      .eq('proprietario_user_id', user.id);
    
    // Aplicar filtros se presentes
    if (fabricanteInversor) {
      query = query.eq('fabricante_inversor', fabricanteInversor);
    }
    
    if (credencialId) {
      query = query.eq('credencial_id', credencialId);
    }
    
    if (comIntegracao) {
      query = query.not('credencial_id', 'is', null);
    }
    
    if (status) {
      query = query.eq('status_planta', status);
    }
    
    // Ordenar por data de criação (mais recente primeiro)
    query = query.order('created_at', { ascending: false });
    
    // Executar a consulta
    const { data, error, count } = await query;
    
    if (error) {
      console.error("Erro ao buscar plantas solares:", error);
      return new Response(JSON.stringify({ error: "Erro ao buscar plantas solares", details: error.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }
    
    // Retornar as plantas solares encontradas
    return new Response(JSON.stringify({ data, count }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    console.error("Erro inesperado na função listar-plantas-solares:", error);
    return new Response(JSON.stringify({ error: error.message || "Erro interno do servidor" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
}); 