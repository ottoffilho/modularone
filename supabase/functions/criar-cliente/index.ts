import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { corsHeaders } from "../_shared/cors.ts";

console.log("Função criar-cliente inicializada.");

// Helper para normalizar CPF/CNPJ (remover não dígitos)
const normalizeCpfCnpj = (value: string) => value.replace(/[^\d]/g, "");
// Helper para normalizar CEP (remover não dígitos)
const normalizeCep = (value: string) => value.replace(/[^\d]/g, "");

// Schemas base para CPF e CNPJ (apenas formato básico, sem validação de dígitos verificadores por simplicidade aqui)
const cpfSchema = z.string().transform(normalizeCpfCnpj).pipe(z.string().length(11, "CPF deve ter 11 dígitos."));
const cnpjSchema = z.string().transform(normalizeCpfCnpj).pipe(z.string().length(14, "CNPJ deve ter 14 dígitos."));

const baseClienteSchema = z.object({
  nome_razao_social: z.string().min(1, "Nome/Razão Social é obrigatório."),
  email: z.string().email("Email inválido."),
  telefone: z.string().min(10, "Telefone inválido."), // Formato básico
  endereco_rua: z.string().min(1, "Rua é obrigatória."),
  endereco_numero: z.string().min(1, "Número é obrigatório."),
  endereco_complemento: z.string().nullable().optional(),
  endereco_bairro: z.string().min(1, "Bairro é obrigatório."),
  endereco_cidade: z.string().min(1, "Cidade é obrigatória."),
  endereco_estado: z.string().length(2, "Estado deve ter 2 caracteres."),
  endereco_cep: z.string().transform(normalizeCep).pipe(z.string().length(8, "CEP deve ter 8 dígitos.")),
  nome_parceiro: z.string().nullable().optional(),
  dados_adicionais: z.object({}).passthrough().nullable().optional(),
});

const clientePfSchema = baseClienteSchema.extend({
  tipo_pessoa: z.literal("PF"),
  cpf_cnpj: cpfSchema,
  data_nascimento: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/, "Data de nascimento deve ser YYYY-MM-DD."),
  nome_fantasia: z.null().optional(), // PJ field, should be null/undefined for PF
});

const clientePjSchema = baseClienteSchema.extend({
  tipo_pessoa: z.literal("PJ"),
  cpf_cnpj: cnpjSchema,
  nome_fantasia: z.string().min(1, "Nome Fantasia é obrigatório para PJ."),
  data_nascimento: z.null().optional(), // PF field, should be null/undefined for PJ
});

const clienteInputSchema = z.discriminatedUnion("tipo_pessoa", [
  clientePfSchema,
  clientePjSchema,
]);

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

    if (req.headers.get("content-type") !== "application/json") {
      return new Response(JSON.stringify({ error: "Requisição deve ser JSON" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 415 });
    }

    const body = await req.json();
    const validationResult = clienteInputSchema.safeParse(body);

    if (!validationResult.success) {
      console.error("Erro de validação do cliente:", validationResult.error.flatten());
      return new Response(JSON.stringify({ error: "Erro de validação", details: validationResult.error.flatten().fieldErrors }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const clienteData = validationResult.data;

    // Preparar dados para inserção
    const insertPayload = {
      proprietario_user_id: proprietarioUserId,
      tipo_pessoa: clienteData.tipo_pessoa,
      nome_razao_social: clienteData.nome_razao_social,
      cpf_cnpj: clienteData.cpf_cnpj, // Já normalizado pelo Zod schema
      email: clienteData.email,
      telefone: clienteData.telefone,
      endereco_rua: clienteData.endereco_rua,
      endereco_numero: clienteData.endereco_numero,
      endereco_complemento: clienteData.endereco_complemento,
      endereco_bairro: clienteData.endereco_bairro,
      endereco_cidade: clienteData.endereco_cidade,
      endereco_estado: clienteData.endereco_estado,
      endereco_cep: clienteData.endereco_cep, // Já normalizado pelo Zod schema
      nome_parceiro: clienteData.nome_parceiro,
      data_nascimento: clienteData.tipo_pessoa === 'PF' ? clienteData.data_nascimento : null,
      nome_fantasia: clienteData.tipo_pessoa === 'PJ' ? clienteData.nome_fantasia : null,
      dados_adicionais: clienteData.dados_adicionais,
      status_cliente: 'ATIVO', // Default status
    };

    const { data: novoCliente, error: insertError } = await supabaseAdminClient
      .from("clientes")
      .insert([insertPayload])
      .select()
      .single();

    if (insertError) {
      console.error("Erro ao inserir cliente:", insertError);
      if (insertError.code === "23505") { // unique_violation
        // O Supabase usa o nome da constraint para detalhar, ex: clientes_proprietario_user_id_cpf_cnpj_key
        return new Response(JSON.stringify({ error: "Conflito: Cliente com este CPF/CNPJ já existe para este proprietário.", details: insertError.message }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 409,
        });
      }
      return new Response(JSON.stringify({ error: "Erro ao criar cliente", details: insertError.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    return new Response(JSON.stringify(novoCliente), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 201,
    });

  } catch (error) {
    console.error("Erro inesperado na função criar-cliente:", error);
    return new Response(JSON.stringify({ error: error.message || "Erro interno do servidor" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
}); 