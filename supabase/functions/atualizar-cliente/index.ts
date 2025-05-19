import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { corsHeaders } from "../_shared/cors.ts";

console.log("Função atualizar-cliente inicializada.");

const idSchema = z.string().uuid("ID do cliente deve ser um UUID válido.");

// Helper para normalizar CEP (remover não dígitos)
const normalizeCep = (value: string) => value.replace(/[^\d]/g, "");

// Schema para os dados atualizáveis do cliente.
// tipo_pessoa e cpf_cnpj não são incluídos aqui pois não permitiremos sua alteração via esta função.
const clienteUpdateDataSchema = z.object({
  nome_razao_social: z.string().min(1, "Nome/Razão Social é obrigatório."),
  email: z.string().email("Email inválido."),
  telefone: z.string().min(10, "Telefone inválido."),
  endereco_rua: z.string().min(1, "Rua é obrigatória."),
  endereco_numero: z.string().min(1, "Número é obrigatório."),
  endereco_complemento: z.string().nullable().optional(),
  endereco_bairro: z.string().min(1, "Bairro é obrigatório."),
  endereco_cidade: z.string().min(1, "Cidade é obrigatória."),
  endereco_estado: z.string().length(2, "Estado deve ter 2 caracteres."),
  endereco_cep: z.string().transform(normalizeCep).pipe(z.string().length(8, "CEP deve ter 8 dígitos.")),
  nome_parceiro: z.string().nullable().optional(),
  dados_adicionais: z.object({}).passthrough().nullable().optional(),
  // Campos específicos de PF/PJ que podem ser atualizados:
  data_nascimento: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/, "Data de nascimento deve ser YYYY-MM-DD.").nullable().optional(),
  nome_fantasia: z.string().min(1, "Nome Fantasia é obrigatório para PJ.").nullable().optional(),
  // status_cliente pode ser atualizado por outra função dedicada (alternar-status-cliente)
});

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "PUT") {
    return new Response(JSON.stringify({ error: "Método não permitido. Use PUT." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 405 
    });
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
    const pathParts = url.pathname.split('/').filter(part => part !== '');
    const clienteIdRaw = pathParts.pop();

    if (!clienteIdRaw) {
        return new Response(JSON.stringify({ error: "ID do cliente não fornecido na URL." }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
    }
    const idValidationResult = idSchema.safeParse(clienteIdRaw);
    if (!idValidationResult.success) {
      return new Response(JSON.stringify({ error: "ID do cliente inválido.", details: idValidationResult.error.flatten().formErrors }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
    }
    const clienteId = idValidationResult.data;

    // Verificar se o cliente existe e pertence ao usuário
    const { data: clienteExistente, error: fetchError } = await supabaseAdminClient
      .from("clientes")
      .select("tipo_pessoa, cpf_cnpj") // Pegar tipo_pessoa para validação condicional
      .eq("id", clienteId)
      .eq("proprietario_user_id", proprietarioUserId)
      .maybeSingle();

    if (fetchError) {
      console.error("Erro ao buscar cliente para atualização:", fetchError);
      return new Response(JSON.stringify({ error: "Erro ao verificar cliente", details: fetchError.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
    }
    if (!clienteExistente) {
      return new Response(JSON.stringify({ error: "Cliente não encontrado ou não pertence ao usuário." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 });
    }

    if (req.headers.get("content-type") !== "application/json") {
      return new Response(JSON.stringify({ error: "Requisição deve ser JSON" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 415 });
    }

    const body = await req.json();
    const validationResult = clienteUpdateDataSchema.safeParse(body);

    if (!validationResult.success) {
      console.error("Erro de validação na atualização do cliente:", validationResult.error.flatten());
      return new Response(JSON.stringify({ error: "Erro de validação", details: validationResult.error.flatten().fieldErrors }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
    }
    const updateData = validationResult.data;
    
    // Validação condicional para campos PF/PJ baseada no tipo_pessoa existente
    if (clienteExistente.tipo_pessoa === 'PF' && updateData.nome_fantasia) {
        return new Response(JSON.stringify({ error: "Nome Fantasia não é aplicável para Pessoa Física."}), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
    }
    if (clienteExistente.tipo_pessoa === 'PJ' && updateData.data_nascimento) {
        return new Response(JSON.stringify({ error: "Data de Nascimento não é aplicável para Pessoa Jurídica."}), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
    }
    if (clienteExistente.tipo_pessoa === 'PJ' && !updateData.nome_fantasia) {
        return new Response(JSON.stringify({ error: "Nome Fantasia é obrigatório para Pessoa Jurídica."}), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
    }

    const payloadFinal = {
        ...updateData,
        data_nascimento: clienteExistente.tipo_pessoa === 'PF' ? updateData.data_nascimento : null,
        nome_fantasia: clienteExistente.tipo_pessoa === 'PJ' ? updateData.nome_fantasia : null,
    };

    const { data: clienteAtualizado, error: updateError } = await supabaseAdminClient
      .from("clientes")
      .update(payloadFinal)
      .eq("id", clienteId)
      .eq("proprietario_user_id", proprietarioUserId)
      .select()
      .single();

    if (updateError) {
      console.error("Erro ao atualizar cliente:", updateError);
      // Aqui poderíamos checar por erros de unicidade se cpf_cnpj fosse atualizável e houvesse conflito
      return new Response(JSON.stringify({ error: "Erro ao atualizar cliente", details: updateError.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
    }

    return new Response(JSON.stringify(clienteAtualizado), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });

  } catch (error) {
    console.error("Erro inesperado na função atualizar-cliente:", error);
    return new Response(JSON.stringify({ error: error.message || "Erro interno do servidor" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
  }
}); 