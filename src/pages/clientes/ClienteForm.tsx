import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { ArrowLeft, Save, Search } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Schema for validating client data
const dadosCadastraisPFSchema = z.object({
  cpf: z.string().min(11, "CPF deve ter 11 dígitos").max(14, "Formato CPF inválido (ex: XXX.XXX.XXX-XX)").optional().or(z.literal('')),
  // rg: z.string().optional(), // Exemplo de outro campo PF
}).optional();

const dadosCadastraisPJSchema = z.object({
  cnpj: z.string().min(14, "CNPJ deve ter 14 dígitos").max(18, "Formato CNPJ inválido (ex: XX.XXX.XXX/XXXX-XX)").optional().or(z.literal('')),
  inscricao_estadual: z.string().optional().or(z.literal('')),
  // razao_social: z.string().optional(), // Nome já é o campo principal
}).optional();

const clienteSchema = z.object({
  tipo: z.enum(['PF', 'PJ'], { required_error: "Selecione o tipo de cliente." }),
  nome_razao_social: z.string().min(3, 'Nome/Razão Social deve ter pelo menos 3 caracteres.'),
  email: z.string().email('Email inválido.'),
  telefone: z.string().min(10, 'Telefone inválido (mín. 10 dígitos).'), // (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
  
  cpf_cnpj: z.string().min(1, "CPF/CNPJ é obrigatório."), // Será validado no superRefine

  // Campos de Endereço Principal
  cep: z.string().regex(/^\d{5}-?\d{3}$/, "CEP inválido. Formato: XXXXX-XXX ou XXXXXXXX").optional().or(z.literal('')),
  logradouro: z.string().optional().or(z.literal('')),
  numero: z.string().optional().or(z.literal('')), // Usado no form, mapear para numero_endereco no DB
  complemento: z.string().optional().or(z.literal('')),
  bairro: z.string().optional().or(z.literal('')),
  cidade: z.string().optional().or(z.literal('')),
  estado: z.string().optional().or(z.literal('')), // Poderia ser um enum com UFs

  dados_cadastrais_pf: dadosCadastraisPFSchema,
  dados_cadastrais_pj: dadosCadastraisPJSchema,

  // Novos campos que podem ser preenchidos pela API (opcionais)
  nome_fantasia: z.string().optional().or(z.literal('')),
  situacao_cadastral: z.string().optional().or(z.literal('')), // Virá de 'descricao_situacao_cadastral'
  
  // Campo para Inscrição Estadual, caso seja PJ e queiramos manter
  inscricao_estadual: z.string().optional().or(z.literal('')),

  // Este campo pode ser usado para armazenar quaisquer outros dados da API que não têm campos diretos
  // ou o objeto inteiro da API para referência futura.
  // No entanto, a instrução é preencher campos e o restante ir para dados_adicionais no Supabase.
  // Por ora, não adicionarei ao Zod schema do formulário, mas construiremos no onSubmit.

}).superRefine((data, ctx) => {
  const { tipo, cpf_cnpj } = data;
  const cleanedCpfCnpj = (cpf_cnpj || '').replace(/\D/g, ''); // Remove non-digits

  if (tipo === 'PF') {
    if (!cleanedCpfCnpj) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "CPF é obrigatório.", path: ['cpf_cnpj'] });
    } else if (cleanedCpfCnpj.length !== 11) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "CPF deve ter 11 dígitos.", path: ['cpf_cnpj'] });
    }
    // Aqui poderia adicionar uma validação de CPF mais robusta (algoritmo)
  } else if (tipo === 'PJ') {
    if (!cleanedCpfCnpj) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "CNPJ é obrigatório.", path: ['cpf_cnpj'] });
    } else if (cleanedCpfCnpj.length !== 14) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "CNPJ deve ter 14 dígitos.", path: ['cpf_cnpj'] });
    }
    // Aqui poderia adicionar uma validação de CNPJ mais robusta (algoritmo)
  }
});

type ClienteFormValues = z.infer<typeof clienteSchema>;

export default function ClienteForm() {
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;
  
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditMode);
  const [isCnpjLoading, setIsCnpjLoading] = useState(false);
  const [cnpjErrorApi, setCnpjErrorApi] = useState<string | null>(null);
  
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const form = useForm<ClienteFormValues>({
    resolver: zodResolver(clienteSchema),
    defaultValues: {
      nome_razao_social: '',
      email: '',
      telefone: '',
      tipo: undefined,
      cpf_cnpj: '',
      
      cep: '',
      logradouro: '',
      numero: '',
      complemento: '',
      bairro: '',
      cidade: '',
      estado: '',

      nome_fantasia: '',
      situacao_cadastral: '',
      inscricao_estadual: '',
    },
  });

  const tipoCliente = form.watch('tipo');

  const handleBuscaCnpj = async () => {
    const cnpjValue = form.getValues('cpf_cnpj');
    if (!cnpjValue || tipoCliente !== 'PJ') return;

    const cleanedCnpj = cnpjValue.replace(/\D/g, '');
    if (cleanedCnpj.length !== 14) {
      toast({ title: "CNPJ Inválido", description: "Por favor, insira um CNPJ com 14 dígitos.", variant: "destructive" });
      return;
    }

    setIsCnpjLoading(true);
    setCnpjErrorApi(null);
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanedCnpj}`);
      const data = await response.json();

      if (!response.ok || data.type === 'service_error' || data.name === 'NotFoundError') {
        const errorMessage = data.message || (data.errors && data.errors[0]?.message) || 'CNPJ não encontrado ou erro na API.';
        throw new Error(errorMessage);
      }
      
      form.setValue('nome_razao_social', data.razao_social || '');
      form.setValue('nome_fantasia', data.nome_fantasia || '');
      form.setValue('email', data.email || form.getValues('email'));
      form.setValue('telefone', data.ddd_telefone_1 || form.getValues('telefone'));
      
      form.setValue('cep', data.cep || '');
      form.setValue('logradouro', data.logradouro || '');
      form.setValue('numero', data.numero || '');
      form.setValue('complemento', data.complemento || '');
      form.setValue('bairro', data.bairro || '');
      form.setValue('cidade', data.municipio || '');
      form.setValue('estado', data.uf || '');
      
      form.setValue('situacao_cadastral', data.descricao_situacao_cadastral || '');
      form.setValue('inscricao_estadual', data.inscricao_estadual || data.inscricoes_estaduais_ativas?.[0]?.inscricao_estadual || '');

      toast({ title: "CNPJ consultado!", description: "Dados carregados no formulário." });

    } catch (error: unknown) {
      console.error('Erro ao buscar CNPJ:', error);
      const message = error instanceof Error ? error.message : "Falha ao consultar CNPJ.";
      setCnpjErrorApi(message);
      toast({ title: "Erro na Consulta", description: message, variant: "destructive" });
    } finally {
      setIsCnpjLoading(false);
    }
  };

  useEffect(() => {
    const loadCliente = async () => {
      if (!isEditMode || !user) {
        setInitialLoading(false);
        return;
      }
      
      try {
        setInitialLoading(true);
        
        const { data, error } = await supabase
          .from('clientes')
          .select('id, nome_razao_social, tipo_pessoa, cpf, cnpj, nome_fantasia, dados_adicionais')
          .eq('id', id)
          .eq('proprietario_user_id', user.id)
          .single();
          
        if (error) throw error;
        
        if (!data) {
          toast({
            title: 'Cliente não encontrado',
            description: 'O cliente que você está tentando editar não existe ou você não tem permissão para acessá-lo.',
            variant: 'destructive',
          });
          navigate('/clientes');
          return;
        }
        
        const da = (data.dados_adicionais as Record<string, unknown>) || {};

        form.reset({
          tipo: data.tipo_pessoa || undefined,
          nome_razao_social: data.nome_razao_social || '',
          email: typeof da.email === 'string' ? da.email : '',
          telefone: typeof da.telefone === 'string' ? da.telefone : '',
          cpf_cnpj: data.tipo_pessoa === 'PF'
            ? (data.cpf || (typeof da.cpf === 'string' ? da.cpf : '') || '')
            : (data.cnpj || (typeof da.cnpj === 'string' ? da.cnpj : '') || ''),
          cep: typeof da.cep === 'string' ? da.cep : '',
          logradouro: typeof da.logradouro === 'string' ? da.logradouro : '',
          numero: typeof da.numero === 'string' ? da.numero : '',
          complemento: typeof da.complemento === 'string' ? da.complemento : '',
          bairro: typeof da.bairro === 'string' ? da.bairro : '',
          cidade: typeof da.cidade === 'string' ? da.cidade : (typeof da.municipio === 'string' ? da.municipio : ''),
          estado: typeof da.estado === 'string' ? da.estado : (typeof da.uf === 'string' ? da.uf : ''),
          nome_fantasia: data.nome_fantasia || (typeof da.nome_fantasia === 'string' ? da.nome_fantasia : '') || '',
          situacao_cadastral: typeof da.situacao_cadastral === 'string' ? da.situacao_cadastral : '',
          inscricao_estadual: typeof da.inscricao_estadual === 'string' ? da.inscricao_estadual : '',
        });
      } catch (error) {
        console.error('Erro ao carregar dados do cliente:', error);
        toast({
          title: 'Erro ao carregar cliente',
          description: 'Não foi possível carregar os dados do cliente para edição.',
          variant: 'destructive',
        });
        navigate('/clientes');
      } finally {
        setInitialLoading(false);
      }
    };
    
    if (isEditMode) {
      loadCliente();
    } else {
      setInitialLoading(false);
    }
  }, [isEditMode, id, user, navigate, toast, form]);

  const onSubmit = async (values: ClienteFormValues) => {
    if (!user) return;
    
    const cleanedCpfCnpj = (values.cpf_cnpj || '').replace(/\D/g, '');

    const dadosSupabase: Record<string, unknown> = {
      email: values.email,
      telefone: values.telefone,
      tipo: values.tipo,
      cep: values.cep,
      logradouro: values.logradouro,
      numero: values.numero,
      complemento: values.complemento,
      bairro: values.bairro,
      cidade: values.cidade,
      estado: values.estado,
      nome_fantasia: values.nome_fantasia,
      situacao_cadastral: values.situacao_cadastral,
      inscricao_estadual: values.inscricao_estadual,
    };

    // Montar o payload conforme a estrutura da tabela clientes
    const payload: Record<string, unknown> = {
      nome_razao_social: values.nome_razao_social,
      tipo_pessoa: values.tipo, // Corrigido para o nome correto da coluna
      dados_adicionais: dadosSupabase,
      proprietario_user_id: user.id,
    };

    if (values.tipo === 'PF') {
      payload.cpf = cleanedCpfCnpj;
      // Limpar campos de PJ
      payload.cnpj = null;
      payload.nome_fantasia = null;
    } else if (values.tipo === 'PJ') {
      payload.cnpj = cleanedCpfCnpj;
      payload.nome_fantasia = values.nome_fantasia;
      // Limpar campos de PF
      payload.cpf = null;
    }

    console.log('Payload enviado para Supabase:', payload);
    try {
      setLoading(true);
      let operationError = null;
      if (isEditMode) {
        const { error } = await supabase
          .from('clientes')
          .update(payload)
          .eq('id', id)
          .eq('proprietario_user_id', user.id);
        operationError = error;
      } else {
        const { error } = await supabase
          .from('clientes')
          .insert([payload]);
        operationError = error;
      }
      if (operationError) throw operationError;
      toast({
        title: isEditMode ? 'Cliente atualizado' : 'Cliente cadastrado',
      });
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      navigate(isEditMode ? `/clientes/detalhes/${id}` : '/clientes');
    } catch (error) {
      console.error('Erro ao salvar cliente:', error);
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar os dados do cliente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading && isEditMode) {
    return (
      <div className="flex justify-center py-12 items-center h-full">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-2 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <Button
            variant="outline"
            size="sm"
            className="mb-2 border-border/70 hover:bg-muted/50 transition-colors duration-150"
            onClick={() => navigate('/clientes')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Lista
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            {isEditMode ? 'Editar Cliente' : 'Adicionar Novo Cliente'}
          </h1>
          <p className="text-muted-foreground mt-1 md:mt-2 text-sm md:text-base">
            {isEditMode
              ? 'Edite as informações do cliente.'
              : 'Preencha os dados para cadastrar um novo cliente.'}
          </p>
        </div>
      </div>

      <Card className="shadow-2xl border border-primary/20 bg-card/80 backdrop-blur-lg rounded-xl overflow-hidden">
        <CardHeader className="border-b border-border/30 bg-muted/20 px-6 py-5">
          <CardTitle className="text-xl text-primary">Informações do Cliente</CardTitle>
          <CardDescription className="text-muted-foreground/90">
            Campos marcados com * são obrigatórios.
          </CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-6 px-6 py-8">
              {/* Campo Tipo de Cliente */}
              <FormField
                control={form.control}
                name="tipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Cliente *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo (PF ou PJ)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="PF">Pessoa Física (PF)</SelectItem>
                        <SelectItem value="PJ">Pessoa Jurídica (PJ)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Campo CPF/CNPJ agora logo abaixo do tipo */}
              <FormField
                control={form.control}
                name="cpf_cnpj"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {tipoCliente === 'PF' ? 'CPF *' : tipoCliente === 'PJ' ? 'CNPJ *' : 'CPF/CNPJ *'}
                    </FormLabel>
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder={tipoCliente === 'PF' ? '000.000.000-00' : tipoCliente === 'PJ' ? '00.000.000/0000-00' : 'Digite o CPF ou CNPJ'}
                          disabled={!tipoCliente}
                        />
                      </FormControl>
                      {tipoCliente === 'PJ' && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={handleBuscaCnpj}
                          disabled={isCnpjLoading || !field.value}
                          className="flex-shrink-0"
                        >
                          {isCnpjLoading ? <Spinner size="sm" /> : <Search className="h-4 w-4" />}
                        </Button>
                      )}
                    </div>
                    {cnpjErrorApi && <p className="text-sm font-medium text-destructive">{cnpjErrorApi}</p>}
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Campo Nome/Razão Social */}
              <FormField
                control={form.control}
                name="nome_razao_social"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome / Razão Social *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Nome completo ou razão social" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email *</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} placeholder="exemplo@dominio.com" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="telefone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="(XX) XXXXX-XXXX" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Seção de Endereço Principal */}
              <div className="mt-6 pt-6 border-t border-border/30">
                <h3 className="text-lg font-medium text-foreground mb-4">Endereço Principal</h3>
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                  <div className="md:col-span-2">
                    <FormField
                      control={form.control}
                      name="cep"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CEP</FormLabel>
                          <FormControl>
                            <Input placeholder="XXXXX-XXX" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="md:col-span-4">
                    <FormField
                      control={form.control}
                      name="logradouro"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Logradouro</FormLabel>
                          <FormControl>
                            <Input placeholder="Rua, Avenida, etc." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <FormField
                      control={form.control}
                      name="numero"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Número</FormLabel>
                          <FormControl>
                            <Input placeholder="123" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="md:col-span-4">
                    <FormField
                      control={form.control}
                      name="complemento"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Complemento</FormLabel>
                          <FormControl>
                            <Input placeholder="Apto, Bloco, Casa" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="md:col-span-3">
                    <FormField
                      control={form.control}
                      name="bairro"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bairro</FormLabel>
                          <FormControl>
                            <Input placeholder="Bairro" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <FormField
                      control={form.control}
                      name="cidade"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cidade</FormLabel>
                          <FormControl>
                            <Input placeholder="Cidade" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="md:col-span-1">
                    <FormField
                      control={form.control}
                      name="estado"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Estado</FormLabel>
                          <FormControl>
                            <Input placeholder="UF" {...field} maxLength={2} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>

              {/* Novos campos preenchidos pela API */}
              {tipoCliente === 'PJ' && (
                <>
                  <FormField
                    control={form.control}
                    name="nome_fantasia"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome Fantasia</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Nome Fantasia (se houver)" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="inscricao_estadual"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Inscrição Estadual</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Número da Inscrição Estadual" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="situacao_cadastral"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Situação Cadastral</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Situação do CNPJ na Receita" readOnly disabled />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row justify-end gap-3 px-6 py-5 border-t border-border/30 bg-muted/20">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/clientes')}
                className="w-full sm:w-auto border-border/70 hover:bg-muted/50 transition-colors duration-150"
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={loading || !form.formState.isDirty || !form.formState.isValid}
                className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition-all duration-150 ease-in-out transform hover:scale-105"
              >
                {loading ? (
                  <Spinner className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {isEditMode ? 'Salvar Alterações' : 'Cadastrar Cliente'}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
