import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { corsHeaders } from "../_shared/cors.ts";

console.log("Função obter-cliente inicializada.");

const idSchema = z.string().uuid("ID do cliente deve ser um UUID válido.");

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

    // Extrair ID do cliente da URL path
    // Ex: /obter-cliente/uuid-valor -> clienteId = uuid-valor
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(part => part !== ''); // Remove partes vazias
    const clienteIdRaw = pathParts.pop(); // Pega o último segmento como ID

    if (!clienteIdRaw) {
        return new Response(JSON.stringify({ error: "ID do cliente não fornecido na URL." }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });
    }

    const validationResult = idSchema.safeParse(clienteIdRaw);
    if (!validationResult.success) {
      return new Response(JSON.stringify({ error: "ID do cliente inválido.", details: validationResult.error.flatten().formErrors }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }
    const clienteId = validationResult.data;

    const { data: cliente, error: clienteError } = await supabaseAdminClient
      .from("clientes")
      .select("*")
      .eq("id", clienteId)
      .eq("proprietario_user_id", proprietarioUserId)
      .maybeSingle(); // Retorna um único objeto ou null, não um array

    if (clienteError) {
      console.error("Erro ao buscar cliente:", clienteError);
      return new Response(JSON.stringify({ error: "Erro ao buscar cliente", details: clienteError.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    if (!cliente) {
      return new Response(JSON.stringify({ error: "Cliente não encontrado ou não pertence ao usuário." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    return new Response(JSON.stringify(cliente), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Erro inesperado na função obter-cliente:", error);
    return new Response(JSON.stringify({ error: error.message || "Erro interno do servidor" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
}); 