import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { corsHeaders } from "../_shared/cors.ts";

console.log("Função deletar-cliente inicializada.");

const idSchema = z.string().uuid("ID do cliente deve ser um UUID válido.");

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "DELETE") {
    return new Response(JSON.stringify({ error: "Método não permitido" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 405,
    });
  }

  try {
    const supabaseAdminClient: SupabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        global: { headers: { Authorization: req.headers.get("Authorization")! } },
      }
    );

    const { data: { user }, error: userError } = await supabaseAdminClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 });
    }
    const proprietarioUserId = user.id;

    // Extrair ID do cliente da URL path
    // Ex: /deletar-cliente/uuid-do-cliente
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const clienteIdRaw = pathParts[pathParts.length - 1];

    const idValidationResult = idSchema.safeParse(clienteIdRaw);
    if (!idValidationResult.success) {
      const errorDetails = idValidationResult.error.flatten();
      return new Response(
        JSON.stringify({
          error: "ID do cliente inválido.",
          details: errorDetails,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const clienteId = idValidationResult.data;

    // 0. Verificar se o cliente existe e pertence ao usuário
    const { data: clienteExistente, error: clienteError } = await supabaseAdminClient
      .from("clientes")
      .select("id")
      .eq("id", clienteId)
      .eq("proprietario_user_id", proprietarioUserId)
      .maybeSingle(); // Use maybeSingle para tratar caso não encontre

    if (clienteError) {
      console.error("Erro ao verificar cliente:", clienteError);
      return new Response(JSON.stringify({ error: "Erro ao verificar cliente", details: clienteError.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    if (!clienteExistente) {
      return new Response(
        JSON.stringify({ error: "Cliente não encontrado ou não pertence ao usuário." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Verificar dependências em unidades_consumidoras
    const { count: ucCount, error: ucError } = await supabaseAdminClient
      .from("unidades_consumidoras")
      .select("id", { count: "exact", head: true })
      .eq("cliente_id", clienteId)
      .eq("proprietario_user_id", proprietarioUserId);

    if (ucError) {
      console.error("Erro ao verificar UCs dependentes:", ucError);
      return new Response(JSON.stringify({ error: "Erro ao verificar dependências (UCs)", details: ucError.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }
    if (ucCount && ucCount > 0) {
      return new Response(
        JSON.stringify({
          error: "Cliente não pode ser excluído pois possui Unidades Consumidoras associadas.",
          details: `Existem ${ucCount} UC(s) associadas. Desvincule-as ou exclua-as primeiro.`,
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } } // 409 Conflict
      );
    }

    // 2. Verificar dependências em plantas_solares
    const { count: plantaCount, error: plantaError } = await supabaseAdminClient
      .from("plantas_solares")
      .select("id", { count: "exact", head: true })
      .eq("cliente_id", clienteId)
      .eq("proprietario_user_id", proprietarioUserId);

    if (plantaError) {
      console.error("Erro ao verificar Plantas Solares dependentes:", plantaError);
      return new Response(JSON.stringify({ error: "Erro ao verificar dependências (Plantas Solares)", details: plantaError.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }
    if (plantaCount && plantaCount > 0) {
      return new Response(
        JSON.stringify({
          error: "Cliente não pode ser excluído pois possui Plantas Solares associadas.",
          details: `Existem ${plantaCount} planta(s) solar(es) associada(s). Desvincule-as ou exclua-as primeiro.`,
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Se não houver dependências, deletar o cliente
    const { error: deleteError } = await supabaseAdminClient
      .from("clientes")
      .delete()
      .eq("id", clienteId)
      .eq("proprietario_user_id", proprietarioUserId);

    if (deleteError) {
      console.error("Erro ao deletar cliente:", deleteError);
      return new Response(JSON.stringify({ error: "Erro ao deletar cliente", details: deleteError.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    return new Response(null, {
      headers: corsHeaders,
      status: 204, // No Content
    });

  } catch (error) {
    console.error("Erro inesperado na função deletar-cliente:", error);
    const errorMessage = error instanceof Error ? error.message : "Ocorreu um erro desconhecido.";
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
}); 