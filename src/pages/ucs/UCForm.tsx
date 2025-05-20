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
  nome_identificador?: string;
}

interface UnidadeGeradora {
  id: string;
  nome_identificador_uc: string;
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

// Schema base para campos comuns da UC
const baseUcSchema = z.object({
  distribuidora_id: z.string().uuid("Selecione a distribuidora"),
  numero_uc: z.string().min(1, "Número da UC é obrigatório"),
  nome_identificador_uc: z.string().min(3, "Nome/Apelido da UC é obrigatório"),
  endereco_cep: z.string().regex(/^\d{5}-\d{3}$/, "CEP inválido").optional().nullable(),
  endereco_logradouro: z.string().optional().nullable(),
  endereco_numero: z.string().optional().nullable(),
  endereco_complemento: z.string().optional().nullable(),
  endereco_bairro: z.string().optional().nullable(),
  endereco_cidade: z.string().optional().nullable(),
  endereco_estado: z.string().length(2, "UF deve ter 2 caracteres").optional().nullable(),
  grupo_tarifario: z.string({ invalid_type_error: 'Grupo tarifário inválido'}).optional().nullable(),
  subgrupo_tarifario: z.string().optional().nullable(),
  modalidade_tarifaria: z.string({ invalid_type_error: 'Modalidade tarifária inválida'}).optional().nullable(),
  classe_consumo: z.string({ invalid_type_error: 'Classe de consumo inválida'}).optional().nullable(),
  subclasse_consumo: z.string().optional().nullable(),
  tensao_nominal_v: z.preprocess(
    (val) => String(val || '').replace(',', '.'),
    z.coerce.number().positive("Tensão deve ser positiva").optional().nullable()
  ),
  numero_medidor: z.string().optional().nullable(),
  status_uc: z.enum(['ATIVA', 'INATIVA', 'PENDENTE'], { required_error: "Status da UC é obrigatório"}).default('ATIVA'),
  data_conexao: z.coerce.date().optional().nullable(), // Usar coerce.date para conversão
  dados_adicionais_uc: z.string().optional().nullable(), 
});

// Schema discriminado para perfis de UC
const ucSchema = z.discriminatedUnion("perfil_uc", [
  z.object({
    perfil_uc: z.literal('GERADORA_PRINCIPAL'),
    planta_solar_id: z.string().uuid("Selecione a Planta Solar").min(1, "Planta Solar é obrigatória"),
    cliente_id: z.string().uuid("Selecione o Cliente proprietário").min(1, "Cliente é obrigatório"),
    fonte_dados_geracao: z.enum(['MANUAL', 'API_GROWATT', 'API_SAJ'], {errorMap: () => ({ message: "Selecione a fonte de dados."})}).default('MANUAL'),
  }).merge(baseUcSchema),
  z.object({
    perfil_uc: z.literal('CONSUMIDORA_BENEFICIARIA'),
    cliente_id: z.string().uuid("Selecione o Cliente").min(1, "Cliente é obrigatório"),
    planta_solar_id: z.string().uuid("ID da Planta Solar inválido").optional().nullable(),
    // Campos de rateio (para tabela 'contratos')
    unidade_geradora_id: z.string().uuid("Selecione a UC Geradora Principal").min(1, "UC Geradora é obrigatória"),
    percentual_rateio: z.preprocess(
      (val) => parseFloat(String(val || '0').replace(',', '.')),
      z.coerce.number().min(0, "Mínimo 0%").max(100, "Máximo 100%")
    ),
    ordem_prioridade_rateio: z.coerce.number().int().positive("Deve ser inteiro positivo").optional().nullable(),
    data_inicio_beneficio: z.coerce.date({required_error: "Data de início do benefício é obrigatória."}),
    data_fim_beneficio: z.coerce.date().optional().nullable(),
  }).merge(baseUcSchema),
  z.object({
    perfil_uc: z.literal('CONSUMIDORA_SIMPLES'),
    cliente_id: z.string().uuid("Selecione o Cliente").optional().nullable(), 
  }).merge(baseUcSchema)
]).superRefine((data, ctx) => {
  if (data.perfil_uc === 'CONSUMIDORA_BENEFICIARIA' && data.data_fim_beneficio && data.data_inicio_beneficio && data.data_fim_beneficio < data.data_inicio_beneficio) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Data final do benefício não pode ser anterior à data inicial.",
      path: ["data_fim_beneficio"],
    });
  }
});

export type UCFormValues = z.infer<typeof ucSchema>;

// Remover mocks de fetchUCById, createUC, updateUC (linhas 171-228)

export default function UCForm() {
  const { id: ucId } = useParams<{ id: string }>();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const clienteIdFromQuery = queryParams.get('cliente');
  
  const isEditMode = !!ucId;
  
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient(); // Manter para invalidação de cache

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditMode);
  const [loadedUcTimestamps, setLoadedUcTimestamps] = useState<{ created_at?: string; updated_at?: string } | null>(null);

  // Estados para selects dinâmicos
  const [distribuidoras, setDistribuidoras] = useState<Distribuidora[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [plantasSolares, setPlantasSolares] = useState<PlantaSolar[]>([]);
  const [unidadesGeradoras, setUnidadesGeradoras] = useState<UnidadeGeradora[]>([]);

  const form = useForm<UCFormValues>({
    resolver: zodResolver(ucSchema),
    defaultValues: {
      // Perfil será setado pelo usuário primeiro
      distribuidora_id: "__SELECT__",
      numero_uc: '',
      nome_identificador_uc: '',
      endereco_cep: null,
      endereco_logradouro: null,
      endereco_numero: null,
      endereco_complemento: null,
      endereco_bairro: null,
      endereco_cidade: null,
      endereco_estado: null,
      grupo_tarifario: null,
      subgrupo_tarifario: null,
      modalidade_tarifaria: null,
      classe_consumo: null,
      subclasse_consumo: null,
      tensao_nominal_v: null,
      numero_medidor: null,
      status_uc: 'ATIVA',
      data_conexao: null,
      dados_adicionais_uc: '',
      // Campos condicionais são tratados pelo discriminatedUnion
      cliente_id: "__SELECT__", // Inicializa com valor não vazio
    },
  });

  const perfilUcSelecionado = form.watch("perfil_uc");

  // Efeito para buscar dados da UC e Contrato (se aplicável) em modo de edição
  useEffect(() => {
    if (isEditMode && ucId && user) {
      const fetchUCAndContractData = async () => {
        setInitialLoading(true);
        setLoadedUcTimestamps(null); // Reset timestamps on new fetch
        try {
          const { data: ucDataFromDB, error: ucError } = await supabase
            .from('unidades_consumidoras')
            .select('*')
            .eq('id', ucId)
            .eq('proprietario_user_id', user.id)
            .single();

          if (ucError) {
            if (ucError.code === 'PGRST116') {
              toast({ title: "Não Encontrado", description: "Unidade Consumidora não encontrada ou acesso negado.", variant: "default" });
              navigate('/ucs');
              return;
            }
            throw ucError;
          }
          
          if (ucDataFromDB) {
            setLoadedUcTimestamps({ created_at: ucDataFromDB.created_at, updated_at: ucDataFromDB.updated_at });
            // Primeiro, resetamos com o perfil e os dados base que podem ser mapeados diretamente
            const baseResetData: Partial<UCFormValues> = {
                ...ucDataFromDB,
                perfil_uc: ucDataFromDB.perfil_uc as UCFormValues['perfil_uc'], // Garantir que perfil_uc está presente
                data_conexao: ucDataFromDB.data_conexao ? new Date(ucDataFromDB.data_conexao) : null,
                dados_adicionais_uc: ucDataFromDB.dados_adicionais_uc && typeof ucDataFromDB.dados_adicionais_uc === 'object' 
                                      ? JSON.stringify(ucDataFromDB.dados_adicionais_uc, null, 2) 
                                      : ucDataFromDB.dados_adicionais_uc,
                tensao_nominal_v: ucDataFromDB.tensao_nominal_v ? parseFloat(String(ucDataFromDB.tensao_nominal_v)) : null,
            };
            form.reset(baseResetData as UCFormValues); // Reset com os dados base e perfil

            // Agora, se for CONSUMIDORA_BENEFICIARIA, buscamos e setamos os dados do contrato
            if (ucDataFromDB.perfil_uc === 'CONSUMIDORA_BENEFICIARIA') {
              const { data: contratoData, error: contratoError } = await supabase
                .from('contratos')
                .select('*')
                .eq('unidade_consumidora_id', ucId)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();
              
              if (contratoError && contratoError.code !== 'PGRST116') { 
                throw contratoError;
              }
              
              if (contratoData) {
                // Usar setValue para campos específicos após o reset inicial
                form.setValue('perfil_uc', 'CONSUMIDORA_BENEFICIARIA'); // Redundante se já no baseResetData, mas garante o tipo
                form.setValue('unidade_geradora_id', contratoData.unidade_geradora_id);
                form.setValue('percentual_rateio', contratoData.percentual_rateio);
                form.setValue('ordem_prioridade_rateio', contratoData.ordem_prioridade_rateio);
                form.setValue('data_inicio_beneficio', contratoData.data_inicio_contrato ? new Date(contratoData.data_inicio_contrato) : new Date());
                form.setValue('data_fim_beneficio', contratoData.data_fim_contrato ? new Date(contratoData.data_fim_contrato) : null);
                // Também popular cliente_id e planta_solar_id se vierem da ucDataFromDB e forem relevantes para este perfil
                form.setValue('cliente_id', ucDataFromDB.cliente_id); 
                if(ucDataFromDB.planta_solar_id) form.setValue('planta_solar_id', ucDataFromDB.planta_solar_id);
              }
            } else if (ucDataFromDB.perfil_uc === 'GERADORA_PRINCIPAL') {
                form.setValue('perfil_uc', 'GERADORA_PRINCIPAL');
                form.setValue('planta_solar_id', ucDataFromDB.planta_solar_id);
                form.setValue('cliente_id', ucDataFromDB.cliente_id);
                form.setValue('fonte_dados_geracao', ucDataFromDB.fonte_dados_geracao || 'MANUAL');
            } else if (ucDataFromDB.perfil_uc === 'CONSUMIDORA_SIMPLES') {
                form.setValue('perfil_uc', 'CONSUMIDORA_SIMPLES');
                if(ucDataFromDB.cliente_id) form.setValue('cliente_id', ucDataFromDB.cliente_id);
            }
          }
        } catch (error: any) {
          console.error("Erro ao carregar dados para edição:", error);
          toast({ title: "Erro ao Carregar", description: error.message || "Não foi possível carregar os dados para edição.", variant: "destructive" });
          navigate('/ucs');
        } finally {
          setInitialLoading(false);
        }
      };
      fetchUCAndContractData();
    } else if (!isEditMode && clienteIdFromQuery) {
        // form.setValue('cliente_id', clienteIdFromQuery); // Adiar para após seleção do perfil
    }

  }, [isEditMode, ucId, user, form, navigate, toast, clienteIdFromQuery]);

  // Efeito para buscar dados para os selects dinâmicos
  useEffect(() => {
    const fetchDataForSelects = async () => {
      if (!user) return; // Só buscar se o usuário estiver logado

      try {
        // Buscar Distribuidoras
        const { data: distribuidorasData, error: distribuidorasError } = await supabase
          .from('distribuidoras')
          .select('id, nome'); // Alterado de nome_abreviado para nome
        if (distribuidorasError) throw distribuidorasError;
        if (distribuidorasData) setDistribuidoras(distribuidorasData); // Simplificado, pois a query já retorna {id, nome}

        // Buscar Clientes (do usuário logado)
        const { data: clientesData, error: clientesError } = await supabase
          .from('clientes')
          .select('id, nome_razao_social')
          .eq('proprietario_user_id', user.id);
        if (clientesError) throw clientesError;
        if (clientesData) setClientes(clientesData);

        // Buscar Plantas Solares (do usuário logado)
        const { data: plantasData, error: plantasError } = await supabase
          .from('plantas_solares')
          .select('id, nome_planta') // Alterado de nome_identificador para nome_planta
          .eq('proprietario_user_id', user.id);
        if (plantasError) throw plantasError;
        if (plantasData) setPlantasSolares(plantasData.map(p => ({ id: p.id, nome_planta: p.nome_planta || 'Planta sem nome' })));

        // Buscar Unidades Geradoras (UCs com perfil GERADORA_PRINCIPAL do usuário logado)
        const { data: ucsGeradorasData, error: ucsGeradorasError } = await supabase
          .from('unidades_consumidoras')
          .select('id, nome_identificador') // Alterado de nome_identificador_uc para nome_identificador conforme hint
          .eq('proprietario_user_id', user.id)
          .eq('tipo_uc', 'GERADORA_PRINCIPAL'); // Alterado de perfil_uc para tipo_uc, assumindo que este é o nome real da coluna
        if (ucsGeradorasError) throw ucsGeradorasError;
        if (ucsGeradorasData) {
          setUnidadesGeradoras(
            ucsGeradorasData.map(ug => ({
              id: ug.id,
              nome_identificador_uc: ug.nome_identificador || 'UC Geradora sem nome' // Mapear para o nome esperado pela interface
            }))
          );
        }

      } catch (error: any) {
        console.error("Erro ao buscar dados para selects:", error);
        toast({ title: "Erro ao Carregar Opções", description: error.message || "Não foi possível carregar dados para os campos de seleção.", variant: "destructive" });
      }
    };

    fetchDataForSelects();
  }, [user, toast]); // Dependência `supabase` é estável e não precisa ser listada geralmente

  const onSubmit = async (values: UCFormValues) => {
    if (!user) {
      toast({ title: "Erro de Autenticação", description: "Usuário não autenticado.", variant: "destructive" });
      return;
    }
    
    // Tratar todos os valores especiais antes de enviar para o backend
    const cleanValues = {...values};
    // Limpar valores especiais dos selects
    if (cleanValues.distribuidora_id === "__SELECT__") {
      toast({ title: "Validação", description: "Selecione uma distribuidora válida.", variant: "destructive" });
      return;
    }

    if ((cleanValues.perfil_uc === 'GERADORA_PRINCIPAL' || cleanValues.perfil_uc === 'CONSUMIDORA_BENEFICIARIA') && 
        cleanValues.cliente_id === "__SELECT__") {
      toast({ title: "Validação", description: "Selecione um cliente válido.", variant: "destructive" });
      return;
    }

    if (cleanValues.perfil_uc === 'CONSUMIDORA_BENEFICIARIA') {
      const beneficiaryValues = cleanValues as any;
      if (beneficiaryValues.unidade_geradora_id === "__SELECT__") {
        toast({ title: "Validação", description: "Selecione uma unidade geradora válida.", variant: "destructive" });
        return;
      }
      
      if (beneficiaryValues.planta_solar_id === "NONE" || beneficiaryValues.planta_solar_id === "__SELECT__") {
        beneficiaryValues.planta_solar_id = null;
      }
    } else if (cleanValues.perfil_uc === 'GERADORA_PRINCIPAL') {
      const generatorValues = cleanValues as any;
      if (generatorValues.planta_solar_id === "__SELECT__") {
        toast({ title: "Validação", description: "Selecione uma planta solar válida.", variant: "destructive" });
        return;
      }
    } else if (cleanValues.perfil_uc === 'CONSUMIDORA_SIMPLES') {
      const simpleValues = cleanValues as any;
      if (simpleValues.cliente_id === "__SELECT__") {
        simpleValues.cliente_id = null; // Cliente é opcional para UC Consumidora Simples
      }
    }

    // Ajustar campos de texto para garantir que não enviem null ao backend
    const textFields = [
      'endereco_cep', 'endereco_logradouro', 'endereco_numero', 'endereco_complemento',
      'endereco_bairro', 'endereco_cidade', 'endereco_estado', 'grupo_tarifario',
      'subgrupo_tarifario', 'modalidade_tarifaria', 'classe_consumo', 'subclasse_consumo',
      'numero_medidor', 'dados_adicionais_uc'
    ];

    textFields.forEach(field => {
      if (cleanValues[field] === null) {
        cleanValues[field] = '';
      }
    });

    setLoading(true);

    // Ajustar o processamento do JSON
    let parsedDadosAdicionais = null;
    if (cleanValues.dados_adicionais_uc && String(cleanValues.dados_adicionais_uc).trim() !== '') {
      try {
        parsedDadosAdicionais = JSON.parse(cleanValues.dados_adicionais_uc);
      } catch (e) {
        // Se não for um JSON válido, usar como texto simples
        parsedDadosAdicionais = cleanValues.dados_adicionais_uc;
      }
    }

    const ucPayload: any = {
      proprietario_user_id: user.id,
      perfil_uc: cleanValues.perfil_uc,
      distribuidora_id: cleanValues.distribuidora_id,
      numero_uc: cleanValues.numero_uc,
      nome_identificador_uc: cleanValues.nome_identificador_uc,
      endereco_cep: cleanValues.endereco_cep,
      endereco_logradouro: cleanValues.endereco_logradouro,
      endereco_numero: cleanValues.endereco_numero,
      endereco_complemento: cleanValues.endereco_complemento,
      endereco_bairro: cleanValues.endereco_bairro,
      endereco_cidade: cleanValues.endereco_cidade,
      endereco_estado: cleanValues.endereco_estado,
      grupo_tarifario: cleanValues.grupo_tarifario,
      subgrupo_tarifario: cleanValues.subgrupo_tarifario,
      modalidade_tarifaria: cleanValues.modalidade_tarifaria,
      classe_consumo: cleanValues.classe_consumo,
      subclasse_consumo: cleanValues.subclasse_consumo,
      tensao_nominal_v: cleanValues.tensao_nominal_v,
      numero_medidor: cleanValues.numero_medidor,
      status_uc: cleanValues.status_uc,
      data_conexao: cleanValues.data_conexao ? new Date(cleanValues.data_conexao).toISOString() : null,
      dados_adicionais_uc: parsedDadosAdicionais,
    };

    // Adicionar campos específicos do perfil ao ucPayload
    // E preparar contratoPayload se necessário
    let contratoPayload: any = null;

    switch (cleanValues.perfil_uc) {
      case 'GERADORA_PRINCIPAL':
        ucPayload.planta_solar_id = cleanValues.planta_solar_id;
        ucPayload.cliente_id = cleanValues.cliente_id;
        ucPayload.fonte_dados_geracao = cleanValues.fonte_dados_geracao;
        break;
      case 'CONSUMIDORA_BENEFICIARIA':
        ucPayload.cliente_id = cleanValues.cliente_id;
        ucPayload.planta_solar_id = cleanValues.planta_solar_id; // Opcional
        
        contratoPayload = {
          proprietario_user_id: user.id,
          cliente_id: cleanValues.cliente_id, 
          // unidade_consumidora_id será setado após salvar a UC
          unidade_geradora_id: cleanValues.unidade_geradora_id,
          percentual_rateio: cleanValues.percentual_rateio,
          ordem_prioridade_rateio: cleanValues.ordem_prioridade_rateio,
          data_inicio_contrato: cleanValues.data_inicio_beneficio ? new Date(cleanValues.data_inicio_beneficio).toISOString() : null,
          data_fim_contrato: cleanValues.data_fim_beneficio ? new Date(cleanValues.data_fim_beneficio).toISOString() : null,
          status_contrato: 'ATIVO', 
        };
        break;
      case 'CONSUMIDORA_SIMPLES':
        ucPayload.cliente_id = cleanValues.cliente_id; // Opcional
        break;
    }

    try {
      let savedUcId: string | undefined = ucId;
      // let savedUcPerfil: UCFormValues['perfil_uc'] | undefined = values.perfil_uc; // Não é mais necessário aqui

      if (isEditMode && ucId) {
        const { data, error } = await supabase
          .from('unidades_consumidoras')
          .update(ucPayload)
          .eq('id', ucId)
          .select('id') // Só precisamos do ID para o contrato
          .single();
        if (error) throw error;
        savedUcId = data?.id;
        toast({ title: "Sucesso", description: `UC ${ucPayload.nome_identificador_uc} atualizada.` });
      } else {
        const { data, error } = await supabase
          .from('unidades_consumidoras')
          .insert(ucPayload)
          .select('id')
          .single();
        if (error) throw error;
        savedUcId = data?.id;
        toast({ title: "Sucesso", description: `UC ${ucPayload.nome_identificador_uc} criada.` });
      }

      // Lógica para Contrato (apenas para CONSUMIDORA_BENEFICIARIA)
      if (savedUcId && cleanValues.perfil_uc === 'CONSUMIDORA_BENEFICIARIA' && contratoPayload) {
        contratoPayload.unidade_consumidora_id = savedUcId; // Adicionar ID da UC salva ao contrato

        let existingContratoId: string | null = null;
        if (isEditMode) { 
            const { data: existingContrato, error: fetchError } = await supabase
                .from('contratos')
                .select('id')
                .eq('unidade_consumidora_id', savedUcId) // Chave para encontrar o contrato existente
                .limit(1)
                .single();
            
            if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
            existingContratoId = existingContrato?.id || null;
        }
        
        if (existingContratoId) {
          const { error: updateContratoError } = await supabase
            .from('contratos')
            .update(contratoPayload)
            .eq('id', existingContratoId);
          if (updateContratoError) throw updateContratoError;
          toast({ title: "Contrato Atualizado", description: "Detalhes do rateio da UC Beneficiária atualizados." });
        } else {
          const { error: insertContratoError } = await supabase
            .from('contratos')
            .insert(contratoPayload);
          if (insertContratoError) throw insertContratoError;
          toast({ title: "Contrato Criado", description: "Detalhes do rateio da UC Beneficiária salvos." });
        }
      } else if (isEditMode && ucId && cleanValues.perfil_uc !== 'CONSUMIDORA_BENEFICIARIA') {
        // Lógica de deleção/desativação de contrato se UC deixou de ser CONSUMIDORA_BENEFICIARIA
        // Exemplo: buscar contrato por unidade_consumidora_id e deletar ou mudar status
        console.log("UC não é mais CONSUMIDORA_BENEFICIARIA, verificar contratos associados.");
      }

      queryClient.invalidateQueries({ queryKey: ['ucs'] });
      if (savedUcId) queryClient.invalidateQueries({ queryKey: ['uc', savedUcId] }); 
      queryClient.invalidateQueries({ queryKey: ['contratos'] }); 
      navigate('/ucs');

    } catch (error: any) {
      console.error("Erro ao salvar UC/Contrato:", error);
      const message = error.message || "Ocorreu um problema ao salvar os dados.";
      if (error.details) console.error("Detalhes do erro Supabase:", error.details);
      if (error.hint) console.error("Dica do Supabase:", error.hint);
      toast({ title: "Erro ao Salvar", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Renderização condicional para o estado de carregamento da página em modo de edição
  if (initialLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Spinner size="lg" />
        <p className="ml-4 text-lg">Carregando dados da Unidade Consumidora...</p>
      </div>
    );
  }

  // A partir daqui, o formulário é renderizado pois não está em initialLoading

  return (
    <div className="container mx-auto max-w-4xl space-y-8 p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isEditMode ? 'Editar Unidade Consumidora' : 'Nova Unidade Consumidora'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isEditMode ? 'Atualize os dados da UC e seu perfil.' : 'Cadastre uma nova UC e defina seu perfil.'}
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => navigate(-1)}
          disabled={loading}
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg md:text-xl">
                {isEditMode ? `Editando UC: ${form.getValues("nome_identificador_uc") || ucId}` : 'Dados da Nova UC'}
              </CardTitle>
              <CardDescription>
                Preencha os detalhes abaixo. Campos marcados com * são obrigatórios.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                  control={form.control}
                  name="perfil_uc"
                  render={({ field }) => (
                  <FormItem>
                      <FormLabel>Perfil da UC *</FormLabel>
                      <Select 
                      onValueChange={(value) => {
                          const currentValues = form.getValues();
                          const resetValues: Partial<UCFormValues> = {
                              // Preservar campos comuns
                              distribuidora_id: currentValues.distribuidora_id,
                              numero_uc: currentValues.numero_uc,
                              nome_identificador_uc: currentValues.nome_identificador_uc,
                              endereco_cep: currentValues.endereco_cep,
                              endereco_logradouro: currentValues.endereco_logradouro,
                              endereco_numero: currentValues.endereco_numero,
                              endereco_complemento: currentValues.endereco_complemento,
                              endereco_bairro: currentValues.endereco_bairro,
                              endereco_cidade: currentValues.endereco_cidade,
                              endereco_estado: currentValues.endereco_estado,
                              grupo_tarifario: currentValues.grupo_tarifario,
                              subgrupo_tarifario: currentValues.subgrupo_tarifario,
                              modalidade_tarifaria: currentValues.modalidade_tarifaria,
                              classe_consumo: currentValues.classe_consumo,
                              subclasse_consumo: currentValues.subclasse_consumo,
                              tensao_nominal_v: currentValues.tensao_nominal_v,
                              numero_medidor: currentValues.numero_medidor,
                              status_uc: currentValues.status_uc,
                              data_conexao: currentValues.data_conexao,
                              dados_adicionais_uc: currentValues.dados_adicionais_uc,
                              
                              // @ts-ignore 
                              perfil_uc: value as UCFormValues['perfil_uc'], 
                              
                              // Zerar campos que dependem do perfil anterior
                              planta_solar_id: null,
                              cliente_id: null, // Cliente pode ser necessário em todos os perfis, mas pode mudar
                              fonte_dados_geracao: undefined,
                              unidade_geradora_id: undefined,
                              percentual_rateio: 0,
                              ordem_prioridade_rateio: null,
                              data_inicio_beneficio: undefined,
                              data_fim_beneficio: null,
                          };
                          form.reset(resetValues);
                          field.onChange(value); 
                      }} 
                      value={field.value || undefined}
                      defaultValue={field.value || undefined}
                      >
                      <FormControl>
                          <SelectTrigger id="perfil_uc">
                          <SelectValue placeholder="Selecione o perfil..." />
                          </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                          <SelectItem value="GERADORA_PRINCIPAL">Geradora Principal (Associada a uma Planta Solar)</SelectItem>
                          <SelectItem value="CONSUMIDORA_BENEFICIARIA">Consumidora Beneficiária (Recebe Créditos)</SelectItem>
                          <SelectItem value="CONSUMIDORA_SIMPLES">Consumidora Simples (Apenas Consumo)</SelectItem>
                      </SelectContent>
                      </Select>
                      <FormMessage />
                  </FormItem>
                  )}
              />
             
              {/* === CAMPOS COMUNS E CONDICIONAIS ABAIXO === */} 
              {perfilUcSelecionado && (
                <>
                  {/* --- Card: Dados Gerais da UC --- */}
                  <Card className="mt-6">
                    <CardHeader>
                      <CardTitle>2. Dados Gerais da Unidade Consumidora</CardTitle>
                      <CardDescription>
                        Informações básicas e de identificação da UC. 
                        {perfilUcSelecionado === 'CONSUMIDORA_BENEFICIARIA' && "O cliente aqui é o titular da fatura da UC Beneficiária."}
                        {perfilUcSelecionado === 'GERADORA_PRINCIPAL' && "O cliente aqui é o proprietário da UC Geradora e da Planta Solar associada."}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="nome_identificador_uc"
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel>Nome/Apelido da UC *</FormLabel>
                            <FormControl>
                              <Input placeholder="Ex: Sítio Alegria - Principal, Casa da Praia, Escritório Centro" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="distribuidora_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Distribuidora de Energia *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || "__SELECT__"}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione a distribuidora" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="__SELECT__">Selecione...</SelectItem>
                                {distribuidoras
                                  .filter(d => d && d.id) // Filtra distribuidoras com id válido
                                  .map((d) => (
                                    <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="numero_uc"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Número da Unidade Consumidora (Contrato) *</FormLabel>
                            <FormControl>
                              <Input placeholder="Ex: 7001234567 (conforme fatura)" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Cliente ID - Relevante para GERADORA_PRINCIPAL e CONSUMIDORA_BENEFICIARIA, opcional para SIMPLES */}
                      {(perfilUcSelecionado === 'GERADORA_PRINCIPAL' || perfilUcSelecionado === 'CONSUMIDORA_BENEFICIARIA' || perfilUcSelecionado === 'CONSUMIDORA_SIMPLES') && (
                        <FormField
                          control={form.control}
                          name="cliente_id"
                          render={({ field }) => (
                            <FormItem className={perfilUcSelecionado === 'CONSUMIDORA_SIMPLES' ? "" : "md:col-span-1"}>
                              <FormLabel>
                                Cliente Titular da UC 
                                {perfilUcSelecionado !== 'CONSUMIDORA_SIMPLES' && "*"}
                                {perfilUcSelecionado === 'CONSUMIDORA_SIMPLES' && " (Opcional)"}
                              </FormLabel>
                              <Select onValueChange={field.onChange} value={field.value || "__SELECT__"}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecione o cliente" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="__SELECT__">Selecione...</SelectItem>
                                  {clientes
                                    .filter(c => c && c.id) // Filtra clientes com id válido
                                    .map((c) => (
                                      <SelectItem key={c.id} value={c.id}>{c.nome_razao_social}</SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </CardContent>
                  </Card>

                  {/* --- Card: Endereço da UC --- */}
                  <Card>
                    <CardHeader>
                      <CardTitle>3. Endereço da Unidade Consumidora</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      <FormField
                        control={form.control}
                        name="endereco_cep"
                        render={({ field }) => (
                          <FormItem className="md:col-span-1">
                            <FormLabel>CEP</FormLabel>
                            <div className="flex gap-2">
                              <FormControl>
                                <Input 
                                  placeholder="00000-000" 
                                  {...field} 
                                  value={field.value || ""} 
                                  onChange={(e) => {
                                    const cep = e.target.value.replace(/\D/g, '');
                                    if (cep.length <= 8) {
                                      field.onChange(cep.replace(/^(\d{5})(\d{3})$/, '$1-$2'));
                                    }
                                  }} 
                                />
                              </FormControl>
                              {/* <Button type="button" variant="outline" size="sm" onClick={() => buscarCep(field.value)}>Buscar</Button> */} 
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="endereco_logradouro"
                        render={({ field }) => (
                          <FormItem className="md:col-span-3">
                            <FormLabel>Logradouro</FormLabel>
                            <FormControl>
                              <Input placeholder="Rua, Avenida, Praça..." {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                       <FormField
                        control={form.control}
                        name="endereco_numero"
                        render={({ field }) => (
                          <FormItem className="md:col-span-1">
                            <FormLabel>Número</FormLabel>
                            <FormControl>
                              <Input placeholder="Ex: 123, S/N" {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                       <FormField
                        control={form.control}
                        name="endereco_complemento"
                        render={({ field }) => (
                          <FormItem className="md:col-span-1">
                            <FormLabel>Complemento</FormLabel>
                            <FormControl>
                              <Input placeholder="Apto, Bloco, Casa" {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="endereco_bairro"
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel>Bairro</FormLabel>
                            <FormControl>
                              <Input placeholder="Nome do Bairro" {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="endereco_cidade"
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel>Cidade</FormLabel>
                            <FormControl>
                              <Input placeholder="Nome da Cidade" {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="endereco_estado"
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel>Estado (UF)</FormLabel>
                             <Select 
                               onValueChange={field.onChange} 
                               value={field.value || "__SELECT__"} 
                               defaultValue="">
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione o estado" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {UFEnum.options.map((uf) => (
                                  <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>
                  
              {/* --- Campos Condicionais por Perfil --- */} 
              {perfilUcSelecionado === 'GERADORA_PRINCIPAL' && (
                <Card>
                  <CardHeader>
                    <CardTitle>4. Dados da Geração (Geradora Principal)</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="planta_solar_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Planta Solar Vinculada *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || "__SELECT__"}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione a planta solar" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="__SELECT__">Selecione...</SelectItem>
                              <SelectItem value="NONE">Nenhuma</SelectItem>
                              {plantasSolares
                                .filter(ps => ps && ps.id) // Filtra plantas solares com id válido
                                .map((ps) => (
                                  <SelectItem key={ps.id} value={ps.id}>{ps.nome_planta}</SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                     <FormField
                      control={form.control}
                      name="fonte_dados_geracao"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Fonte dos Dados de Geração *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || 'MANUAL'}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione a fonte dos dados" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="MANUAL">Lançamento Manual</SelectItem>
                              <SelectItem value="API_GROWATT">API Growatt (Em breve)</SelectItem>
                              <SelectItem value="API_SAJ">API SAJ (Em breve)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              )}

              {perfilUcSelecionado === 'CONSUMIDORA_BENEFICIARIA' && (
                <Card>
                  <CardHeader>
                    <CardTitle>4. Configuração de Rateio (Consumidora Beneficiária)</CardTitle>
                    <CardDescription>
                      Defina como esta UC receberá os créditos de geração da UC Geradora Principal.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="unidade_geradora_id" // Este é o ID da UC Geradora Principal
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>UC Geradora Principal Vinculada *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || "__SELECT__"}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione a UC geradora dos créditos" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="__SELECT__">Selecione...</SelectItem>
                              {unidadesGeradoras
                                .filter(ug => ug && ug.id) // Filtra unidades geradoras com id válido
                                .map((ug) => (
                                  <SelectItem key={ug.id} value={ug.id}>{ug.nome_identificador_uc}</SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="percentual_rateio"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Percentual de Rateio (%)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Ex: 50.5"
                              {...field}
                              value={field.value ?? ""}
                              onChange={(e) => {
                                const { value } = e.target;
                                if (value === "" || /^[0-9]*[.,]?[0-9]{0,2}$/.test(value)) {
                                  field.onChange(value);
                                }
                              }}
                              type="number"
                              step="0.01" // Permite duas casas decimais
                            />
                          </FormControl>
                          <FormDescription>
                            Valor entre 0 e 100.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="ordem_prioridade_rateio"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ordem de Prioridade do Rateio</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Ex: 1"
                              {...field}
                              value={field.value ?? ""}
                              onChange={(e) => {
                                const { value } = e.target;
                                if (value === "" || /^[0-9]*$/.test(value)) {
                                  field.onChange(value);
                                }
                              }}
                              type="number"
                              step="1" // Apenas inteiros
                            />
                          </FormControl>
                          <FormDescription>
                            Número inteiro positivo.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="data_inicio_beneficio"
                      render={({ field }) => (
                        <FormItem className="flex flex-col pt-2">
                          <FormLabel>Data de Início do Benefício *</FormLabel>
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
                                  {field.value ? format(field.value, "dd/MM/yyyy") : <span>Escolha uma data</span>}
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="data_fim_beneficio"
                      render={({ field }) => (
                        <FormItem className="flex flex-col pt-2">
                          <FormLabel>Data Final do Benefício (Opcional)</FormLabel>
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
                                  {field.value ? format(field.value, "dd/MM/yyyy") : <span>Escolha uma data</span>}
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {/* Opcional: planta_solar_id para CONSUMIDORA_BENEFICIARIA, se ela também tiver uma planta pequena, por ex. */}
                    <FormField
                      control={form.control}
                      name="planta_solar_id" 
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Planta Solar Associada (Opcional, se houver uma específica para esta UC beneficiária)</FormLabel>
                                                        <Select onValueChange={field.onChange} value={field.value || "__SELECT__"}>
                      <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecione uma planta solar (opcional)" />
                                  </SelectTrigger>
                      </FormControl>
                                <SelectContent>
                                  <SelectItem value="__SELECT__">Selecione...</SelectItem>
                                  <SelectItem value="NONE">Nenhuma</SelectItem>
                                  {plantasSolares
                                    .filter(ps => ps && ps.id) // Filtra plantas solares com id válido
                                    .map((ps) => (
                                      <SelectItem key={ps.id} value={ps.id}>{ps.nome_planta}</SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              )}

              {/* --- Card: Dados Técnicos e Tarifários --- */}
              <Card>
                <CardHeader>
                  <CardTitle>{perfilUcSelecionado === 'CONSUMIDORA_BENEFICIARIA' || perfilUcSelecionado === 'GERADORA_PRINCIPAL' ? '5' : '4'}. Dados Técnicos e Tarifários</CardTitle>
                  <CardDescription>Informações da fatura de energia e características técnicas da instalação.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <FormField
                    control={form.control}
                    name="grupo_tarifario"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Grupo Tarifário</FormLabel>
                        {/* TODO: Usar Select se os valores forem fixos e conhecidos (ex: GrupoTarifarioEnum) */}
                        <FormControl><Input placeholder="Ex: A, B" {...field} value={field.value || ""} /></FormControl>
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
                        <FormControl><Input placeholder="Ex: A4, B1" {...field} value={field.value || ""} /></FormControl>
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
                        <FormControl><Input placeholder="Ex: Azul, Verde, Branca, Convencional" {...field} value={field.value || ""} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="classe_consumo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Classe de Consumo</FormLabel>
                        <FormControl><Input placeholder="Ex: Residencial, Comercial" {...field} value={field.value || ""} /></FormControl>
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
                        <FormControl><Input placeholder="Ex: Baixa Renda" {...field} value={field.value || ""} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="tensao_nominal_v"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tensão Nominal (V)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ex: 220"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) => {
                              const { value } = e.target;
                              // Permitir string vazia ou valor numérico (com ponto ou vírgula)
                              if (value === "" || /^[0-9]*[.,]?[0-9]*$/.test(value)) {
                                field.onChange(value);
                              }
                            }}
                            type="number"
                            step="any" // Permite qualquer decimal
                          />
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
                        <FormControl><Input placeholder="Conforme fatura ou medidor físico" {...field} value={field.value || ""} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="data_conexao"
                    render={({ field }) => (
                        <FormItem className="flex flex-col pt-2">
                        <FormLabel>Data de Conexão/Ligação</FormLabel>
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
                                {field.value ? format(new Date(field.value), "dd/MM/yyyy") : <span>Escolha uma data</span>}
                                </Button>
                            </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                mode="single"
                                selected={field.value ? new Date(field.value) : undefined}
                                onSelect={field.onChange}
                                initialFocus
                            />
                            </PopoverContent>
                        </Popover>
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
                                                  <Select onValueChange={field.onChange} value={field.value || 'ATIVA'}>
                      <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione o status" />
                                    </SelectTrigger>
                      </FormControl>
                                    <SelectContent>
                                    {/* Idealmente, usar StatusUCEnum.options se definido como z.enum */}
                                    <SelectItem value="ATIVA">Ativa</SelectItem>
                                    <SelectItem value="INATIVA">Inativa</SelectItem>
                                    <SelectItem value="PENDENTE">Pendente</SelectItem>
                                    </SelectContent>
                                </Select>
                            <FormMessage />
                            </FormItem>
                        )}
                     />
                    <FormField
                        control={form.control}
                        name="dados_adicionais_uc"
                        render={({ field }) => (
                            <FormItem className="md:col-span-3">
                            <FormLabel>Observações / Dados Adicionais (JSON)</FormLabel>
                            <FormControl>
                                <Textarea
                                placeholder='{ "chave": "valor", "observacao": "Detalhes importantes sobre esta UC..." }'
                                {...field}
                                value={field.value || ""}
                                rows={3}
                                />
                            </FormControl>
                            <FormDescription>
                                Insira um objeto JSON válido ou texto simples para observações.
                            </FormDescription>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                </CardContent>
              </Card>
            </>
          )}
        </CardContent>
        <CardFooter className="flex justify-between border-t pt-4 pb-4 text-sm text-muted-foreground">
          <div>
            {isEditMode && loadedUcTimestamps?.updated_at && (
              `Última atualização: ${format(new Date(loadedUcTimestamps.updated_at), 'dd/MM/yyyy HH:mm')}`
            )}
          </div>
          <div>
          {isEditMode && loadedUcTimestamps?.created_at && (
            `Criado em: ${format(new Date(loadedUcTimestamps.created_at), 'dd/MM/yyyy HH:mm')}`
          )}
          </div>
      </CardFooter>
      </Card>


      <div className="flex justify-end pt-2">
        <Button type="button" variant="ghost" onClick={() => navigate(-1)} disabled={loading} className="mr-2">
          Cancelar
        </Button>
        <Button type="submit" disabled={loading || !perfilUcSelecionado || !form.formState.isValid} className="min-w-[150px]">
          {loading ? (
            <>
              <Spinner className="mr-2 h-4 w-4" /> 
              Salvando...
            </>
          ) : (
            <><Save className="mr-2 h-4 w-4" />{isEditMode ? 'Salvar Alterações' : 'Cadastrar UC'}</>
          )}
        </Button>
      </div>
    </form>
  </Form>
</div>
);
}