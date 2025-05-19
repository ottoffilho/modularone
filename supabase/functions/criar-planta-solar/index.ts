import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { corsHeaders } from "../_shared/cors.ts";

console.log("Função criar-planta-solar inicializada.");

const plantaSolarSchema = z.object({
  nome_da_planta: z.string().min(1, "Nome da planta é obrigatório."),
  id_externo: z.string().nullable().optional(),
  tipo_sistema_externo: z.string().nullable().optional(),
  potencia_instalada_kwp: z.number().positive("Potência deve ser um número positivo."),
  data_instalacao: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/, "Data de instalação deve estar no formato YYYY-MM-DD."),
  endereco_rua: z.string().min(1, "Rua é obrigatória."),
  endereco_numero: z.string().min(1, "Número é obrigatório."),
  endereco_complemento: z.string().nullable().optional(),
  endereco_bairro: z.string().min(1, "Bairro é obrigatório."),
  endereco_cidade: z.string().min(1, "Cidade é obrigatória."),
  endereco_estado: z.string().length(2, "Estado deve ter 2 caracteres."),
  endereco_cep: z.string().regex(/^\\d{5}-?\\d{3}$/, "CEP deve estar no formato XXXXX-XXX ou XXXXXXXX."),
  geolocalizacao_latitude: z.number().min(-90).max(90).nullable().optional(),
  geolocalizacao_longitude: z.number().min(-180).max(180).nullable().optional(),
  dados_adicionais: z.object({}).passthrough().nullable().optional(), // Permite qualquer objeto JSONB
}).refine(data => {
  if ((data.geolocalizacao_latitude !== null && data.geolocalizacao_latitude !== undefined) && (data.geolocalizacao_longitude === null || data.geolocalizacao_longitude === undefined)) {
    return false; // Longitude é obrigatória se latitude for fornecida
  }
  if ((data.geolocalizacao_longitude !== null && data.geolocalizacao_longitude !== undefined) && (data.geolocalizacao_latitude === null || data.geolocalizacao_latitude === undefined)) {
    return false; // Latitude é obrigatória se longitude for fornecida
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
      console.error("Erro ao buscar usuário ou usuário não autenticado:", userError);
      return new Response(JSON.stringify({ error: "Não autorizado", details: userError?.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }
    const proprietarioUserId = user.id;

    if (req.headers.get("content-type") !== "application/json") {
      return new Response(JSON.stringify({ error: "Requisição deve ser JSON" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 415,
      });
    }

    const body = await req.json();
    const validationResult = plantaSolarSchema.safeParse(body);

    if (!validationResult.success) {
      console.error("Erro de validação:", validationResult.error.flatten());
      return new Response(JSON.stringify({ 
        error: "Erro de validação", 
        details: validationResult.error.flatten().fieldErrors 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const plantaData = validationResult.data;

    const enderecoCompleto = [
      plantaData.endereco_rua,
      plantaData.endereco_numero,
      plantaData.endereco_complemento,
      plantaData.endereco_bairro,
      plantaData.endereco_cidade,
      plantaData.endereco_estado,
      plantaData.endereco_cep?.replace(/\D/g, '') // CORREÇÃO: Removida barra extra
    ].filter(Boolean).join(', ');

    let geolocalizacaoFormatted = null;
    if (plantaData.geolocalizacao_longitude != null && plantaData.geolocalizacao_latitude != null) {
      // CORREÇÃO: Removidas barras extras de escape
      geolocalizacaoFormatted = `POINT(${plantaData.geolocalizacao_longitude} ${plantaData.geolocalizacao_latitude})`;
    }
    
    const { data: novaPlanta, error: insertError } = await supabaseAdminClient
      .from("plantas_solares")
      .insert([{
        proprietario_user_id: proprietarioUserId,
        cliente_id: null, // Conforme nossa decisão
        nome_da_planta: plantaData.nome_da_planta,
        id_externo: plantaData.id_externo,
        tipo_sistema_externo: plantaData.tipo_sistema_externo,
        potencia_instalada_kwp: plantaData.potencia_instalada_kwp,
        data_instalacao: plantaData.data_instalacao,
        endereco: enderecoCompleto,
        geolocalizacao: geolocalizacaoFormatted, // Supabase geography type
        dados_adicionais: plantaData.dados_adicionais,
        // created_at e updated_at são gerenciados pelo Supabase/trigger
      }])
      .select()
      .single();

    if (insertError) {
      console.error("Erro ao inserir planta solar:", insertError);
      // Verificar se é erro de unicidade
      if (insertError.code === "23505") { // Código para unique_violation
        return new Response(JSON.stringify({ error: "Conflito: Já existe uma planta solar com o mesmo ID externo e tipo de sistema para este proprietário.", details: insertError.message }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 409,
        });
      }
      return new Response(JSON.stringify({ error: "Erro ao criar planta solar", details: insertError.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    console.log("Planta solar criada com sucesso:", novaPlanta);
    return new Response(JSON.stringify(novaPlanta), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 201,
    });

  } catch (error) {
    console.error("Erro inesperado na função criar-planta-solar:", error);
    return new Response(JSON.stringify({ error: error.message || "Erro interno do servidor" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
}); 