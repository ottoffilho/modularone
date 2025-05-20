import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { ArrowLeft, Save } from 'lucide-react';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
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
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';

interface Cliente {
  id: string;
  nome_razao_social: string;
}

interface Distribuidora {
  id: string;
  nome: string;
}

interface PlantaSolar {
  id: string;
  nome_planta: string;
}

// Definição dos Enums Zod (ajuste as opções conforme seu schema SQL)
export const TipoUCEnum = z.enum(
  [
    "Residencial",
    "Comercial",
    "Industrial",
    "Rural",
    "Poder Publico",
    "Servico Publico",
    "Consumo Proprio",
  ],
  {
    errorMap: () => ({ message: "Selecione um tipo de UC válido." }),
  }
);
export const UFEnum = z.enum(
  [
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
    "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
    "SP", "SE", "TO",
  ],
  {
    errorMap: () => ({ message: "Selecione uma UF válida." }),
  }
);
export const StatusUCEnum = z.enum(
  ["Ativa", "Inativa", "Pendente", "Bloqueada"],
  {
    errorMap: () => ({ message: "Selecione um status válido." }),
  }
);
export const GrupoTarifarioEnum = z.enum(["A", "B"], { // Adicione mais conforme necessário
  errorMap: () => ({ message: "Selecione um grupo tarifário válido." }),
});

// Regex para CEP (exemplo: 12345-678)
const cepRegex = /^\d{5}-\d{3}$/;

// Schema Zod expandido para Unidade Consumidora
export const ucSchema = z.object({
  id: z.string().uuid().optional(),
  cliente_id: z.string().uuid({ message: "Cliente é obrigatório." }),
  planta_solar_id: z.string().uuid({ message: "Planta solar deve ser um UUID válido se fornecida." }).nullable().optional(),
  identificador: z.string().trim().min(1, "Identificador é obrigatório."),
  tipo_uc: TipoUCEnum,
  cep: z.string().regex(cepRegex, "CEP inválido. Formato esperado: 00000-000").nullable().optional(),
  logradouro: z.string().trim().min(1, "Logradouro é obrigatório.").nullable().optional(),
  numero: z.string().trim().min(1, "Número é obrigatório.").nullable().optional(),
  complemento: z.string().trim().nullable().optional(),
  bairro: z.string().trim().min(1, "Bairro é obrigatório.").nullable().optional(),
  municipio: z.string().trim().min(1, "Município é obrigatório.").nullable().optional(),
  uf: UFEnum.nullable().optional(),
  latitude: z.coerce.number({ invalid_type_error: "Latitude deve ser um número." }).nullable().optional(),
  longitude: z.coerce.number({ invalid_type_error: "Longitude deve ser um número." }).nullable().optional(),
  status_uc: StatusUCEnum.default('Ativa'),
  data_conexao: z.date({ invalid_type_error: "Data de conexão inválida." }).nullable().optional(),
  grupo_tarifario: GrupoTarifarioEnum.nullable().optional(),
  subgrupo_tarifario: z.string().trim().nullable().optional(),
  modalidade_tarifaria: z.string().trim().nullable().optional(),
  classe_consumo: z.string().trim().nullable().optional(),
  subclasse_consumo: z.string().trim().nullable().optional(),
  codigo_tarifa: z.string().trim().nullable().optional(),
  demanda_contratada_ponta_kw: z.coerce.number({ invalid_type_error: "Demanda deve ser um número." }).gte(0, "Demanda não pode ser negativa.").nullable().optional(),
  demanda_contratada_fora_ponta_kw: z.coerce.number({ invalid_type_error: "Demanda deve ser um número." }).gte(0, "Demanda não pode ser negativa.").nullable().optional(),
  tensao_nominal_v: z.coerce.number({ invalid_type_error: "Tensão nominal deve ser um número inteiro." }).int("Tensão nominal deve ser um número inteiro.").positive("Tensão nominal deve ser positiva.").nullable().optional(),
  tipo_medicao: z.string().trim().nullable().optional(),
  numero_medidor: z.string().trim().nullable().optional(),
  dados_adicionais_uc: z.string().refine((val) => {
    if (val === null || val === undefined || val.trim() === "") return true;
    try {
      JSON.parse(val);
      return true;
    } catch (e) {
      return false;
    }
  }, { message: "Dados adicionais devem ser um JSON válido ou vazio." }).nullable().optional(),
});

export type UCFormValuesFromZod = z.infer<typeof ucSchema>;

// Mock das funções de API (substitua pelas suas chamadas reais)
// Essas funções devem corresponder ao que suas Edge Functions esperam.
// Adicione tipos para os payloads e retornos.
// Exemplo: Database['public']['Tables']['unidades_consumidoras']['Insert']
// Exemplo: Database['public']['Tables']['unidades_consumidoras']['Row']

const fetchUCById = async (id: string): Promise<any> => { // Substitua 'any' pelo tipo correto
  // Simula a busca de dados da UC
  console.log(`Fetching UC with id: ${id}`);
  // const { data, error } = await supabase.from('unidades_consumidoras').select('*').eq('id', id).single();
  // if (error) throw error;
  // return data;
  // Exemplo de retorno mockado:
  if (id === "mock-id-123") {
    return {
      id: "mock-id-123",
      cliente_id: "mock-cliente-uuid",
      planta_solar_id: "mock-planta-uuid",
      identificador: "UC-001",
      tipo_uc: "Residencial",
      cep: "12345-678",
      logradouro: "Rua Exemplo",
      numero: "123",
      complemento: "Apto 101",
      bairro: "Centro",
      municipio: "Cidade Exemplo",
      uf: "SP",
      latitude: -23.550520,
      longitude: -46.633308,
      status_uc: "Ativa",
      data_conexao: "2023-01-15", // API retorna string, será convertida para Date
      grupo_tarifario: "B",
      subgrupo_tarifario: "B1",
      modalidade_tarifaria: "Branca",
      classe_consumo: "Residencial",
      subclasse_consumo: "Baixa Renda",
      codigo_tarifa: "T123",
      demanda_contratada_ponta_kw: 10.5,
      demanda_contratada_fora_ponta_kw: 20.0,
      tensao_nominal_v: 220,
      tipo_medicao: "Direta",
      numero_medidor: "MED98765",
      dados_adicionais_uc: JSON.stringify({ info: "Detalhe adicional" }), // API retorna string JSON
    };
  }
  return null;
};

const createUC = async (ucData: any): Promise<any> => { // Substitua 'any' pelo tipo correto
  console.log("Creating UC:", ucData);
  // const { data, error } = await supabase.functions.invoke('criar-unidade-consumidora', { body: ucData });
  // if (error) throw error;
  // return data;
  return { ...ucData, id: `new-uc-${Date.now()}` }; // Simula criação
};

const updateUC = async (ucData: any): Promise<any> => { // Substitua 'any' pelo tipo correto
  console.log("Updating UC:", ucData);
  // const { data, error } = await supabase.functions.invoke('atualizar-unidade-consumidora', { body: ucData });
  // if (error) throw error;
  // return data;
  return ucData; // Simula atualização
};

export default function UCForm() {
  const { id: ucId } = useParams<{ id: string }>();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const clienteIdFromQuery = queryParams.get('cliente');
  
  const isEditMode = !!ucId;
  
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const form = useForm<UCFormValuesFromZod>({
    resolver: zodResolver(ucSchema),
    defaultValues: {
      cliente_id: clienteIdFromQuery || "",
      planta_solar_id: null,
      identificador: '',
      tipo_uc: undefined,
      cep: null,
      logradouro: null,
      numero: null,
      complemento: null,
      bairro: null,
      municipio: null,
      uf: undefined,
      latitude: null,
      longitude: null,
      status_uc: "Ativa",
      data_conexao: null,
      grupo_tarifario: undefined,
      subgrupo_tarifario: null,
      modalidade_tarifaria: null,
      classe_consumo: null,
      subclasse_consumo: null,
      codigo_tarifa: null,
      demanda_contratada_ponta_kw: null,
      demanda_contratada_fora_ponta_kw: null,
      tensao_nominal_v: null,
      tipo_medicao: null,
      numero_medidor: null,
      dados_adicionais_uc: null,
    },
  });

  const { data: ucData, isLoading: isLoadingUCFromQuery, isError: isErrorUC, error: errorUC, isSuccess: isSuccessUC } = useQuery<UCFormValuesFromZod | null, Error>({
    queryKey: ["uc", ucId],
    queryFn: () => {
      if (!ucId) return Promise.resolve(null);
      return fetchUCById(ucId) as Promise<UCFormValuesFromZod | null>; // Ensure fetchUCById returns a typed promise
    },
    enabled: isEditMode,
    // onSuccess, onError, onSettled are no longer top-level options in TanStack Query v5 for useQuery
    // Logic from onSuccess/onError needs to be handled in useEffect or by how useQuery updates its state
  });

  useEffect(() => {
    if (isEditMode && isSuccessUC && ucData) {
      const formData: Partial<UCFormValuesFromZod> = {
        ...ucData,
        data_conexao: ucData.data_conexao ? new Date(ucData.data_conexao) : null,
        // Ensure other fields that might need transformation from ucData (if its type is different from form) are handled
      };
      form.reset(formData);
    } else if (isEditMode && isSuccessUC && !ucData) {
      // Successfully fetched, but no data (e.g., UC not found for the ID)
      toast({
        title: 'Erro ao carregar dados',
        description: 'Unidade Consumidora não encontrada ou dados indisponíveis.',
        variant: 'destructive',
      });
      navigate('/ucs');
    }
  }, [isEditMode, isSuccessUC, ucData, form, navigate]);

  useEffect(() => {
    if (isEditMode && isErrorUC && errorUC) {
      console.error("Erro ao buscar UC:", errorUC);
      toast({
        title: 'Erro ao carregar dados',
        description: errorUC.message || 'Não foi possível carregar os dados da Unidade Consumidora.',
        variant: 'destructive',
      });
      navigate('/ucs');
    }
  }, [isEditMode, isErrorUC, errorUC, navigate]);

  // Gerenciamento de estado de carregamento principal da página/formulário
  const pageLoading = isEditMode && isLoadingUCFromQuery;
  // pageError is implicitly handled by the useEffect above which navigates away or toasts

  const createUCMutation = useMutation<any, Error, Partial<UCFormValuesFromZod>>({
    mutationFn: createUC, // createUC should accept Partial<UCFormValuesFromZod> and return Promise<any>
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ucs"] });
      toast({ title: "Sucesso", description: "Unidade Consumidora criada." });
      if (clienteIdFromQuery) {
        navigate(`/clientes/${clienteIdFromQuery}`);
      } else {
        navigate("/ucs");
      }
    },
    onError: (error: any) => {
      console.error("Erro ao criar Unidade Consumidora:", error);
      toast({
        variant: "destructive",
        title: "Erro ao criar",
        description: error.message || "Não foi possível criar a Unidade Consumidora.",
      });
    },
  });

  const updateUCMutation = useMutation<any, Error, UCFormValuesFromZod & { id: string }>({
    mutationFn: updateUC, // updateUC should accept UCFormValuesFromZod & { id: string } and return Promise<any>
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ucs"] });
      queryClient.invalidateQueries({ queryKey: ["uc", ucId] });
      toast({ title: "Sucesso", description: "Unidade Consumidora atualizada." });
      if (clienteIdFromQuery) {
        navigate(`/clientes/${clienteIdFromQuery}`);
      } else {
        navigate("/ucs");
      }
    },
    onError: (error: any) => {
      console.error("Erro ao atualizar Unidade Consumidora:", error);
      toast({
        variant: "destructive",
        title: "Erro ao atualizar",
        description: error.message || "Não foi possível atualizar a Unidade Consumidora.",
      });
    },
  });

  const onSubmit = async (values: UCFormValuesFromZod) => {
    // if (!user) return; // Reabilitar se useAuth for usado
    
    const submissionData: any = {
      ...values,
      data_conexao: values.data_conexao ? format(values.data_conexao, "yyyy-MM-dd") : null,
      latitude: (typeof values.latitude === 'number' && !isNaN(values.latitude)) ? values.latitude : null,
      longitude: (typeof values.longitude === 'number' && !isNaN(values.longitude)) ? values.longitude : null,
      demanda_contratada_ponta_kw: (typeof values.demanda_contratada_ponta_kw === 'number' && !isNaN(values.demanda_contratada_ponta_kw)) ? values.demanda_contratada_ponta_kw : null,
      demanda_contratada_fora_ponta_kw: (typeof values.demanda_contratada_fora_ponta_kw === 'number' && !isNaN(values.demanda_contratada_fora_ponta_kw)) ? values.demanda_contratada_fora_ponta_kw : null,
      tensao_nominal_v: (typeof values.tensao_nominal_v === 'number' && !isNaN(values.tensao_nominal_v)) ? values.tensao_nominal_v : null,
    };
    
    if (isEditMode && ucId) {
      updateUCMutation.mutate({ ...submissionData, id: ucId });
    } else {
      const { id, ...createData } = submissionData;
      createUCMutation.mutate(createData);
    }
  };
  
  // O estado de loading do botão de submit agora é derivado de isPending das mutações
  const isSubmitting = createUCMutation.isPending || updateUCMutation.isPending;

  // Renderização condicional para o estado de carregamento da página em modo de edição
  if (pageLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Spinner size="lg" />
        <p className="ml-4 text-lg">Carregando dados da Unidade Consumidora...</p>
      </div>
    );
  }

  // Renderização condicional para erro ao carregar dados da UC em modo de edição
  if (isErrorUC) {
     return (
      <div className="container mx-auto p-4 text-center">
        <h2 className="text-xl text-red-500">Erro ao Carregar Dados</h2>
        <p>Não foi possível carregar os dados da Unidade Consumidora. Por favor, tente novamente mais tarde.</p>
        <Button onClick={() => navigate('/ucs')} className="mt-4">Voltar para Lista</Button>
      </div>
    );
  }

  // A partir daqui, o formulário é renderizado pois não está em pageLoading nem pageError
  // O estado `initialLoading` anterior foi substituído por `pageLoading` e `pageError` para clareza

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">
            {isEditMode ? 'Editar' : 'Nova'} Unidade Consumidora
          </h1>
          <p className="text-muted-foreground mt-1">
            {isEditMode 
              ? 'Atualize os dados da unidade consumidora.' 
              : 'Cadastre uma nova unidade consumidora.'}
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => navigate(-1)}
          disabled={isSubmitting}
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-lg md:text-xl">
            {isEditMode ? `Editando UC: ${ucData ? ((ucData as any)?.identificador || (ucData as any)?.id) : ucId}` : 'Dados da Nova UC'}
          </CardTitle>
          <CardDescription>
            Preencha os campos abaixo com os dados da unidade consumidora.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 md:space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                <FormField
                  control={form.control}
                  name="cliente_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cliente ID *</FormLabel>
                      <FormControl>
                        {/* TODO: Substituir por Select com busca de clientes */}
                        <Input placeholder="ID do Cliente (UUID)" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="planta_solar_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Planta Solar ID</FormLabel>
                      <FormControl>
                        {/* TODO: Substituir por Select com busca de plantas solares */}
                        <Input placeholder="ID da Planta Solar (UUID)" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="identificador"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Identificador da UC *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: UC-00123" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                <FormField
                  control={form.control}
                  name="tipo_uc"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de UC *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? undefined} defaultValue={field.value ?? undefined}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {TipoUCEnum.options.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="status_uc"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status da UC *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? undefined} defaultValue={field.value ?? undefined}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {StatusUCEnum.options.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="data_conexao"
                  render={({ field }) => (
                    <FormItem className="flex flex-col pt-0 md:pt-[0.6rem]">
                      <FormLabel>Data de Conexão</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {field.value ? (
                                format(field.value, "dd/MM/yyyy")
                              ) : (
                                <span>Escolha uma data</span>
                              )}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value ?? undefined}
                            onSelect={(date) => field.onChange(date ?? null)}
                            disabled={(date) =>
                              date > new Date() || date < new Date("1900-01-01")
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6">
                <FormField
                  control={form.control}
                  name="cep"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CEP</FormLabel>
                      <FormControl>
                        <Input placeholder="00000-000" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="logradouro"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Logradouro</FormLabel>
                      <FormControl>
                        <Input placeholder="Rua, Avenida, etc." {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="numero"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: 123, S/N" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6">
                <FormField
                  control={form.control}
                  name="complemento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Complemento</FormLabel>
                      <FormControl>
                        <Input placeholder="Apto, Bloco, Casa" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="bairro"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bairro</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome do Bairro" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="municipio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Município</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome do Município" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="uf"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>UF</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? undefined} defaultValue={field.value ?? undefined}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="UF" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {UFEnum.options.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <FormField
                  control={form.control}
                  name="latitude"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Latitude</FormLabel>
                      <FormControl>
                        <Input type="number" step="any" placeholder="-23.550520" {...field} 
                               value={field.value === null || field.value === undefined ? '' : field.value}
                               onChange={e => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="longitude"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Longitude</FormLabel>
                      <FormControl>
                        <Input type="number" step="any" placeholder="-46.633308" {...field} 
                               value={field.value === null || field.value === undefined ? '' : field.value}
                               onChange={e => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                <FormField
                  control={form.control}
                  name="grupo_tarifario"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Grupo Tarifário</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? undefined} defaultValue={field.value ?? undefined}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o grupo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {GrupoTarifarioEnum.options.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="subgrupo_tarifario"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subgrupo Tarifário</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: B1, A4" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="modalidade_tarifaria"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Modalidade Tarifária</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Convencional, Branca, Azul" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                <FormField
                  control={form.control}
                  name="classe_consumo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Classe de Consumo</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Residencial" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="subclasse_consumo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subclasse de Consumo</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Baixa Renda" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="codigo_tarifa"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código da Tarifa</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: T001" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <FormField
                  control={form.control}
                  name="demanda_contratada_ponta_kw"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Demanda Contratada Ponta (kW)</FormLabel>
                      <FormControl>
                        <Input type="number" step="any" placeholder="Ex: 150.5" {...field} 
                               value={field.value === null || field.value === undefined ? '' : field.value}
                               onChange={e => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="demanda_contratada_fora_ponta_kw"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Demanda Contratada Fora Ponta (kW)</FormLabel>
                      <FormControl>
                        <Input type="number" step="any" placeholder="Ex: 200" {...field} 
                               value={field.value === null || field.value === undefined ? '' : field.value}
                               onChange={e => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                <FormField
                  control={form.control}
                  name="tensao_nominal_v"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tensão Nominal (V)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="Ex: 220" {...field} 
                               value={field.value === null || field.value === undefined ? '' : field.value}
                               onChange={e => field.onChange(e.target.value === '' ? null : parseInt(e.target.value, 10))} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="tipo_medicao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Medição</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Direta, Indireta" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="numero_medidor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número do Medidor</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: MEDIDOR123XYZ" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="dados_adicionais_uc"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dados Adicionais (JSON)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder='{ "chave": "valor", "observacao": "Teste" }'
                        {...field}
                        value={field.value ?? ""}
                        rows={4}
                      />
                    </FormControl>
                    <FormDescription>
                      Insira um objeto JSON válido ou deixe em branco.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end pt-4">
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="min-w-[150px]"
                >
                  {isSubmitting ? (
                    <>
                      <Spinner className="mr-2 h-4 w-4" /> 
                      {isEditMode ? "Salvando..." : "Criando..."}
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" /> 
                      {isEditMode ? "Salvar Alterações" : "Criar Unidade Consumidora"}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex justify-between border-t pt-4 pb-4 text-sm text-muted-foreground">
          <div>
            {isEditMode && ucData && (
              `Última atualização: ${(ucData as any)?.updated_at ? format(new Date((ucData as any)?.updated_at), 'dd/MM/yyyy HH:mm') : 'N/A'}`
            )}
          </div>
           <div>
            {isEditMode && ucData && (
              `Criado em: ${(ucData as any)?.created_at ? format(new Date((ucData as any)?.created_at), 'dd/MM/yyyy HH:mm') : 'N/A'}`
            )}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}