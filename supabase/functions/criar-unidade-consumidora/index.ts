import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { corsHeaders } from "../_shared/cors.ts";

console.log("Função criar-unidade-consumidora inicializada.");

// ENUMs definidos no banco de dados
const enumTipoUc = z.enum(["consumidora", "geradora", "beneficiária"]);
const enumFonteDadosGeracao = z.enum(["Growatt", "SAJ", "Manual", "Outra"]);

const unidadeConsumidoraSchema = z.object({
  distribuidora_id: z.string().uuid("ID da distribuidora deve ser um UUID válido."),
  numero_da_uc: z.string().min(1, "Número da UC é obrigatório."), // Adicionar mais validações de formato se necessário
  nome_identificador: z.string().min(1, "Nome identificador é obrigatório."),
  endereco_rua: z.string().min(1, "Rua é obrigatória."),
  endereco_numero: z.string().min(1, "Número é obrigatório."),
  endereco_complemento: z.string().nullable().optional(),
  endereco_bairro: z.string().min(1, "Bairro é obrigatório."),
  endereco_cidade: z.string().min(1, "Cidade é obrigatória."),
  endereco_estado: z.string().length(2, "Estado deve ter 2 caracteres."),
  endereco_cep: z.string().regex(/^\d{5}-?\d{3}$/, "CEP deve estar no formato XXXXX-XXX ou XXXXXXXX."),
  geolocalizacao_latitude: z.number().min(-90).max(90).nullable().optional(),
  geolocalizacao_longitude: z.number().min(-180).max(180).nullable().optional(),
  tipo_de_uc: enumTipoUc,
  fonte_dados_geracao: enumFonteDadosGeracao.nullable().optional(),
  planta_solar_id: z.string().uuid("ID da planta solar deve ser um UUID válido.").nullable().optional(),
  cliente_id: z.string().uuid("ID do cliente deve ser um UUID válido.").nullable().optional(),
  dados_adicionais: z.object({}).passthrough().nullable().optional(),
  // Campos para UCs consumidoras/beneficiárias (não usados para UC geradora do proprietário inicialmente)
  // uc_geradora_principal_id: z.string().uuid().nullable().optional(),
  // percentual_rateio_creditos: z.number().min(0).max(100).nullable().optional(),
}).refine(data => {
  if (data.tipo_de_uc === "geradora") {
    return !!data.planta_solar_id && !!data.fonte_dados_geracao;
  }
  return true;
}, {
  message: "Para UC geradora, ID da planta solar e fonte de dados de geração são obrigatórios.",
  path: ["planta_solar_id", "fonte_dados_geracao"],
}).refine(data => {
  if ((data.geolocalizacao_latitude !== null && data.geolocalizacao_latitude !== undefined) && (data.geolocalizacao_longitude === null || data.geolocalizacao_longitude === undefined)) {
    return false;
  }
  if ((data.geolocalizacao_longitude !== null && data.geolocalizacao_longitude !== undefined) && (data.geolocalizacao_latitude === null || data.geolocalizacao_latitude === undefined)) {
    return false;
  }
  return true;
}, {
  message: "Latitude e Longitude devem ser fornecidas juntas ou ambas omitidas.",
  path: ["geolocalizacao_latitude", "geolocalizacao_longitude"],
});

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdminClient: SupabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseAdminClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 });
    }
    const proprietarioUserId = user.id;

    if (req.headers.get("content-type") !== "application/json") {
      return new Response(JSON.stringify({ error: "Requisição deve ser JSON" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 415 });
    }

    const body = await req.json();
    const validationResult = unidadeConsumidoraSchema.safeParse(body);

    if (!validationResult.success) {
      // Usando any para contornar a limitação do TypeScript
      // em reconhecer corretamente a discriminação de union types
      const result = validationResult as any;
      console.error("Erro de validação da UC:", result.error.flatten());
      return new Response(JSON.stringify({ error: "Erro de validação", details: result.error.flatten().fieldErrors }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const ucData = validationResult.data;

    // Verificar existência da distribuidora_id (tabela global)
    const { data: distribuidora, error: distribuidoraError } = await supabaseAdminClient
      .from("distribuidoras")
      .select("id")
      .eq("id", ucData.distribuidora_id)
      .maybeSingle();

    if (distribuidoraError || !distribuidora) {
      return new Response(JSON.stringify({ error: "Distribuidora não encontrada.", details: distribuidoraError?.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404, // Ou 400 se considerar um erro de validação de input
      });
    }

    // Se cliente_id for fornecido, verificar sua existência e se pertence ao usuário
    if (ucData.cliente_id) {
      const { data: cliente, error: clienteError } = await supabaseAdminClient
        .from("clientes")
        .select("id")
        .eq("id", ucData.cliente_id)
        .eq("user_id", proprietarioUserId) // Garante que o cliente pertence ao usuário autenticado
        .maybeSingle();

      if (clienteError || !cliente) {
        return new Response(JSON.stringify({ error: "Cliente não encontrado ou não pertence ao usuário.", details: clienteError?.message }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404, // Ou 400 se considerar um erro de validação de input
        });
      }
    }

    // Se for UC Geradora, verificar planta_solar_id
    if (ucData.tipo_de_uc === "geradora") {
      if (!ucData.planta_solar_id) { // Double check, Zod deveria pegar isso
         return new Response(JSON.stringify({ error: "ID da planta solar é obrigatório para UC geradora."}), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
      }
      const { data: plantaSolar, error: plantaSolarError } = await supabaseAdminClient
        .from("plantas_solares")
        .select("id")
        .eq("id", ucData.planta_solar_id)
        .eq("proprietario_user_id", proprietarioUserId) // Garante que a planta pertence ao usuário
        .maybeSingle();

      if (plantaSolarError || !plantaSolar) {
        return new Response(JSON.stringify({ error: "Planta solar não encontrada ou não pertence ao usuário.", details: plantaSolarError?.message }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404, // Ou 400
        });
      }
    }

    const enderecoCompleto = [
      ucData.endereco_rua,
      ucData.endereco_numero,
      ucData.endereco_complemento,
      ucData.endereco_bairro,
      ucData.endereco_cidade,
      ucData.endereco_estado,
      ucData.endereco_cep?.replace(/\D/g, '')
    ].filter(Boolean).join(', ');

    let geolocalizacaoFormatted = null;
    if (ucData.geolocalizacao_longitude != null && ucData.geolocalizacao_latitude != null) {
      geolocalizacaoFormatted = `POINT(${ucData.geolocalizacao_longitude} ${ucData.geolocalizacao_latitude})`;
    }

    const insertPayload: Record<string, unknown> = {
      proprietario_user_id: proprietarioUserId,
      cliente_id: ucData.cliente_id,
      distribuidora_id: ucData.distribuidora_id,
      numero_da_uc: ucData.numero_da_uc,
      nome_identificador: ucData.nome_identificador,
      endereco: enderecoCompleto,
      geolocalizacao: geolocalizacaoFormatted,
      tipo_de_uc: ucData.tipo_de_uc,
      fonte_dados_geracao: ucData.tipo_de_uc === 'geradora' ? ucData.fonte_dados_geracao : null,
      planta_solar_id: ucData.tipo_de_uc === 'geradora' ? ucData.planta_solar_id : null,
      dados_adicionais: ucData.dados_adicionais,
      // uc_geradora_principal_id e percentual_rateio_creditos serão null por padrão ou não incluídos
    };
    
    // Lógica para UC Consumidora/Beneficiária seria adicionada aqui, definindo cliente_id etc.
    // Por enquanto, focamos na UC Geradora do proprietário.

    const { data: novaUc, error: insertError } = await supabaseAdminClient
      .from("unidades_consumidoras")
      .insert([insertPayload])
      .select()
      .single();

    if (insertError) {
      console.error("Erro ao inserir UC:", insertError);
      if (insertError.code === "23505") { // unique_violation
        return new Response(JSON.stringify({ error: "Conflito: Já existe uma UC com este número para o proprietário.", details: insertError.message }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 409,
        });
      }
      return new Response(JSON.stringify({ error: "Erro ao criar unidade consumidora", details: insertError.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    return new Response(JSON.stringify(novaUc), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 201,
    });

  } catch (error) {
    console.error("Erro inesperado na função criar-unidade-consumidora:", error);
    const errorMessage = error instanceof Error ? error.message : "Ocorreu um erro desconhecido.";
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
}); 