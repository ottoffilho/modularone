import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

console.log("Função listar-clientes inicializada.");

// Helper para normalizar CPF/CNPJ (remover não dígitos)
const normalizeCpfCnpj = (value: string | null): string | null => {
  if (!value) return null;
  return value.replace(/[^\d]/g, "");
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdminClient: SupabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const { data: { user }, error: userError } = await supabaseAdminClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 });
    }
    const proprietarioUserId = user.id;

    const url = new URL(req.url);
    const params = url.searchParams;

    // Filtros
    const nomeQuery = params.get("nome");
    const cpfCnpjQueryRaw = params.get("cpf_cnpj");
    const cpfCnpjQueryNormalized = normalizeCpfCnpj(cpfCnpjQueryRaw);
    const tipoPessoaQuery = params.get("tipo_pessoa");
    const statusClienteQuery = params.get("status_cliente");

    // Paginação
    const pageParam = params.get("page");
    const limitParam = params.get("limit");
    const page = pageParam ? parseInt(pageParam, 10) : 1;
    const limit = limitParam ? parseInt(limitParam, 10) : 10;
    if (isNaN(page) || page < 1 || isNaN(limit) || limit < 1) {
      return new Response(JSON.stringify({ error: "Parâmetros de paginação inválidos." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }
    const offset = (page - 1) * limit;

    // Ordenação
    const sortBy = params.get("sort") || "created_at";
    const sortOrderParam = params.get("order")?.toLowerCase();
    const ascending = sortOrderParam === "desc" ? false : true;
    // Validar sortBy para evitar injeção de SQL (simplificado aqui, idealmente checar contra lista de campos permitidos)
    const allowedSortFields = ["nome_razao_social", "cpf_cnpj", "email", "created_at", "status_cliente", "tipo_pessoa"];
    if (!allowedSortFields.includes(sortBy)) {
        return new Response(JSON.stringify({ error: "Parâmetro de ordenação inválido." }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });
    }

    let query = supabaseAdminClient
      .from("clientes")
      .select("*", { count: "exact" })
      .eq("proprietario_user_id", proprietarioUserId);

    if (nomeQuery) {
      query = query.ilike("nome_razao_social", `%${nomeQuery}%`);
    }
    if (cpfCnpjQueryNormalized) {
      query = query.eq("cpf_cnpj", cpfCnpjQueryNormalized);
    }
    if (tipoPessoaQuery && (tipoPessoaQuery === "PF" || tipoPessoaQuery === "PJ")) {
      query = query.eq("tipo_pessoa", tipoPessoaQuery);
    }
    if (statusClienteQuery) { // Adicionar validação para valores de status permitidos se necessário
        query = query.eq("status_cliente", statusClienteQuery);
    }
    
    query = query.order(sortBy, { ascending });
    query = query.range(offset, offset + limit - 1);

    const { data: clientes, error: clientesError, count } = await query;

    if (clientesError) {
      console.error("Erro ao buscar clientes:", clientesError);
      return new Response(JSON.stringify({ error: "Erro ao buscar clientes", details: clientesError.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    return new Response(JSON.stringify({ 
      clientes,
      count: count ?? 0,
      page,
      limit,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Erro inesperado na função listar-clientes:", error);
    return new Response(JSON.stringify({ error: error.message || "Erro interno do servidor" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
}); 