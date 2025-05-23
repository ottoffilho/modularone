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
import { Textarea } from '@/components/ui/textarea';
import { CalendarIcon, ArrowLeft, Save, MapPin } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
} from '@/components/ui/select';
import { 
  FabricanteInversor, 
  StatusPlantaSolar, 
  TipoSistemaPlantaSolar 
} from '@/lib/enums';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

// Schema para validação do formulário
const plantaSolarSchema = z.object({
  nome_identificador: z.string().min(3, "O nome da planta solar é obrigatório e deve ter no mínimo 3 caracteres."),
  apelido: z.string().min(3, "O apelido deve ter pelo menos 3 caracteres.").optional().nullable(),
  ano_instalacao: z.number({ invalid_type_error: "Ano deve ser um número"}).optional().nullable(), 
  mes_dia_instalacao: z.date().optional().nullable(), 
  identificacao_concessionaria: z.string().optional().nullable(),
  endereco_cep: z.string().regex(/^\d{5}-\d{3}$/, "CEP inválido.").optional().nullable(),
  endereco_logradouro: z.string().min(1, "Logradouro é obrigatório.").optional().nullable(),
  endereco_numero: z.string().min(1, "Número é obrigatório.").optional().nullable(),
  endereco_complemento: z.string().optional().nullable(),
  endereco_bairro: z.string().min(1, "Bairro é obrigatório.").optional().nullable(),
  endereco_cidade: z.string().min(1, "Cidade é obrigatória.").optional().nullable(),
  endereco_estado: z.string().length(2, "UF deve ter 2 caracteres.").optional().nullable(),
  latitude: z.preprocess(
    (val) => (typeof val === 'string' ? String(val).replace(',', '.') : val),
    z.coerce.number().min(-90, "Latitude inválida").max(90, "Latitude inválida").optional().nullable()
  ),
  longitude: z.preprocess(
    (val) => (typeof val === 'string' ? String(val).replace(',', '.') : val),
    z.coerce.number().min(-180, "Longitude inválida").max(180, "Longitude inválida").optional().nullable()
  ),
  potencia_pico_kwp: z.preprocess(
    (val) => {
      const strVal = String(val || '').replace(',', '.');
      return strVal; // Deixa o coerce.number lidar com string vazia se for o caso.
    },
    z.coerce.number({required_error: "Potência de pico é obrigatória.", invalid_type_error: "Potência de pico deve ser um número."})
              .positive("A potência instalada deve ser um número positivo.")
  ),
  status_planta: z.nativeEnum(StatusPlantaSolar, { 
    required_error: "Selecione o status da planta" 
  }).default(StatusPlantaSolar.ATIVA),
  observacoes: z.string().optional().nullable(),
  tipo_sistema: z.nativeEnum(TipoSistemaPlantaSolar, { 
    required_error: "Selecione o tipo de sistema" 
  }).optional().nullable(),
  potencia_inversor_kw: z.preprocess(
    (val) => {
      const strVal = String(val || '').replace(',', '.');
      return strVal === '' ? undefined : strVal; // Se string vazia, trata como undefined para .optional() funcionar bem
    }, 
    z.coerce.number({invalid_type_error: "Potência do inversor deve ser um número." })
      .positive("Deve ser positivo")
      .optional()
      .nullable()
  ),
  fabricante_inversor: z.nativeEnum(FabricanteInversor, {
    required_error: "Selecione o fabricante do inversor"
  }),
  fabricante_planta_id: z.string().min(1, "O Nº de Série do Inversor / ID da Planta no Fabricante é obrigatório.").optional().nullable(),
  cliente_id: z.string().uuid({ message: "Selecione um cliente válido." }).optional().nullable(),
  credencial_id: z.string().uuid({ message: "Selecione uma credencial válida." }).optional().nullable(),
  tipo_instalacao: z.string().optional().nullable(),
  numero_modulos: z.coerce.number().int().positive("Deve ser inteiro positivo").optional().nullable(),
  potencia_modulo_wp: z.coerce.number().positive("Deve ser positivo").optional().nullable(),
  fabricante_inversor_id: z.string().uuid("ID de fabricante inválido").optional().nullable(),
  modelo_inversor: z.string().optional().nullable(),
  numero_serie_inversor: z.string().optional().nullable(),
  fabricante_modulos_id: z.string().uuid("ID de fabricante inválido").optional().nullable(),
  modelo_modulos: z.string().optional().nullable(),
  numero_serie_modulos: z.string().optional().nullable(),
  empresa_instaladora_id: z.string().uuid("ID de empresa inválido").optional().nullable(),
});

// Tipo derivado do schema
type PlantaSolarFormValues = z.infer<typeof plantaSolarSchema>;

// Array com todos os valores do enum FabricanteInversor para usar no Select
const fabricanteInversorOptions = Object.keys(FabricanteInversor).map(key => ({
  value: FabricanteInversor[key as keyof typeof FabricanteInversor],
  label: key.replace(/_/g, ' ')
}));

// Gera uma lista de anos para o Select
const currentYear = new Date().getFullYear();
const ANO_INICIAL_OPCOES = 1970;
const anoOptions = Array.from({ length: currentYear - ANO_INICIAL_OPCOES + 6 }, (_, i) => {
  const year = ANO_INICIAL_OPCOES + i;
  return { value: year, label: year.toString() };
}).reverse(); // Mais recentes primeiro

export default function PlantaSolarForm() {
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;
  
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditMode);
  const [isCepLoading, setIsCepLoading] = useState(false);
  const [cepErrorApi, setCepErrorApi] = useState<string | null>(null);
  const [userCredentials, setUserCredentials] = useState<Array<{id: string, nome_referencia: string, fabricante_id: string, fabricante_nome: string}>>([]);
  const [loadingCredentials, setLoadingCredentials] = useState(false);
  
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const form = useForm<PlantaSolarFormValues>({
    // @ts-ignore - Incompatibilidade de tipos entre versões do Zod
    resolver: zodResolver(plantaSolarSchema),
    defaultValues: {
      nome_identificador: '',
      apelido: null,
      ano_instalacao: null,
      mes_dia_instalacao: null,
      identificacao_concessionaria: null,
      endereco_cep: null,
      endereco_logradouro: null,
      endereco_numero: null,
      endereco_bairro: null,
      endereco_cidade: null,
      endereco_estado: null,
      latitude: null,
      longitude: null,
      potencia_pico_kwp: undefined,
      status_planta: StatusPlantaSolar.ATIVA,
      observacoes: null,
      tipo_sistema: null,
      potencia_inversor_kw: null,
      fabricante_inversor: undefined,
      fabricante_planta_id: null,
      cliente_id: null,
      credencial_id: null,
      tipo_instalacao: null,
      numero_modulos: null,
      potencia_modulo_wp: null,
      fabricante_inversor_id: null,
      modelo_inversor: null,
      numero_serie_inversor: null,
      fabricante_modulos_id: null,
      modelo_modulos: null,
      numero_serie_modulos: null,
      empresa_instaladora_id: null,
    },
  });

  // Adicionado para acompanhar mudanças no CEP
  const cepValue = form.watch('endereco_cep');

  // Busca os dados da planta solar a ser editada
  useEffect(() => {
    const fetchPlantaSolar = async () => {
      if (!isEditMode || !user) return;
      
      try {
        setInitialLoading(true);
        
        const { data, error } = await supabase
          .from('plantas_solares')
          .select('*')
          .eq('id', id)
          .eq('proprietario_user_id', user.id)
          .single();
          
        if (error) throw error;
        
        if (!data) {
          toast({
            title: 'Planta solar não encontrada',
            description: 'A planta solar que você está tentando editar não existe ou você não tem permissão para acessá-la.',
            variant: 'destructive',
          });
          navigate('/plantas-solares');
          return;
        }
        
        // Parse date string to Date object if available
        let anoInstalacaoValue: number | null = null;
        let mesDiaInstalacaoValue: Date | null = null;

        if (data.data_instalacao) {
          const dt = new Date(data.data_instalacao);
          if (!isNaN(dt.getTime())) {
            anoInstalacaoValue = dt.getFullYear();
            // Criar uma data com ano fixo (ex: ano atual) para o seletor de mês/dia,
            // ou usar o próprio ano se o DayPicker se comportar bem.
            // Para simplicidade, vamos focar em armazenar e exibir.
            mesDiaInstalacaoValue = dt; 
          }
        }
        
        // Set form values
        form.reset({
          nome_identificador: data.nome_identificador || '',
          apelido: data.apelido,
          ano_instalacao: anoInstalacaoValue,
          mes_dia_instalacao: mesDiaInstalacaoValue,
          identificacao_concessionaria: data.identificacao_concessionaria,
          endereco_cep: data.endereco_cep,
          endereco_logradouro: data.endereco_logradouro,
          endereco_numero: data.endereco_numero,
          endereco_bairro: data.endereco_bairro,
          endereco_cidade: data.endereco_cidade,
          endereco_estado: data.endereco_estado,
          latitude: data.latitude,
          longitude: data.longitude,
          potencia_pico_kwp: data.potencia_pico_kwp,
          status_planta: data.status_planta || StatusPlantaSolar.ATIVA,
          observacoes: data.observacoes,
          tipo_sistema: data.tipo_sistema,
          potencia_inversor_kw: data.potencia_inversor_kw,
          fabricante_inversor: data.fabricante_inversor || undefined,
          fabricante_planta_id: data.fabricante_planta_id,
          cliente_id: data.cliente_id,
          credencial_id: data.credencial_id,
          tipo_instalacao: data.tipo_instalacao,
          numero_modulos: data.quantidade_modulos,
          potencia_modulo_wp: data.potencia_modulo_wp,
          fabricante_inversor_id: data.fabricante_inversor_id,
          modelo_inversor: data.modelo_inversor,
          numero_serie_inversor: data.numero_serie_inversor,
          fabricante_modulos_id: data.fabricante_modulos_id,
          modelo_modulos: data.modelo_modulos,
          numero_serie_modulos: data.numero_serie_modulos,
          empresa_instaladora_id: data.empresa_instaladora_id,
        });
      } catch (error) {
        console.error('Erro ao carregar planta solar:', error);
        toast({
          title: 'Erro',
          description: 'Não foi possível carregar os dados da planta solar.',
          variant: 'destructive',
        });
        navigate('/plantas-solares');
      } finally {
        setInitialLoading(false);
      }
    };
    
    fetchPlantaSolar();
  }, [isEditMode, id, user, form, navigate, toast]);

  // Buscar as credenciais do usuário
  useEffect(() => {
    const fetchCredenciais = async () => {
      if (!user) return;
      
      try {
        setLoadingCredentials(true);
        
        // Buscar credenciais do usuário com JOIN para obter o nome do fabricante
        const { data, error } = await supabase
          .from('credenciais_servico_usuario')
          .select(`
            id, 
            nome_referencia, 
            fabricante_id,
            fabricantes_api(nome)
          `)
          .eq('proprietario_user_id', user.id)
          .eq('status_validacao', 'VALIDO'); // Só buscar credenciais válidas
          
        if (error) throw error;
        
        if (data && data.length > 0) {
          // Mapear os dados para incluir o nome do fabricante de forma fácil de usar
          const credentialsWithManufacturer = data.map(cred => {
            // Forçar tipo para contornar o erro de TypeScript
            const fabricanteData = cred.fabricantes_api as any;
            const nomeFabricante = fabricanteData?.nome || 
                                  (Array.isArray(fabricanteData) && fabricanteData[0]?.nome) || 
                                  'DESCONHECIDO';
            
            return {
              id: cred.id,
              nome_referencia: cred.nome_referencia || 'Credencial sem nome',
              fabricante_id: cred.fabricante_id,
              fabricante_nome: String(nomeFabricante).toUpperCase()
            };
          });
          
          setUserCredentials(credentialsWithManufacturer);
        }
      } catch (error) {
        console.error('Erro ao carregar credenciais:', error);
        toast({
          title: 'Erro',
          description: 'Não foi possível carregar as credenciais para integração.',
          variant: 'destructive',
        });
      } finally {
        setLoadingCredentials(false);
      }
    };
    
    fetchCredenciais();
  }, [user, toast]);

  // Obter o fabricante selecionado para filtrar credenciais
  const selectedFabricante = form.watch('fabricante_inversor');
  
  // Filtrar credenciais compatíveis com o fabricante selecionado
  const filteredCredentials = userCredentials.filter(
    cred => cred.fabricante_nome === selectedFabricante
  );
  
  // Efeito para limpar a credencial quando mudar o fabricante
  useEffect(() => {
    // Se o fabricante mudar e a credencial atual não for compatível, limpar a seleção
    const currentCredentialId = form.getValues('credencial_id');
    if (currentCredentialId) {
      const isCompatible = filteredCredentials.some(cred => cred.id === currentCredentialId);
      if (!isCompatible) {
        form.setValue('credencial_id', null);
      }
    }
  }, [selectedFabricante, filteredCredentials, form]);

  // Função para buscar endereço pelo CEP (atualizada)
  const fetchAddressByCep = async (cep: string) => {
    if (!cep) return;
    
    // Limpar formatação para ter apenas números
    const cleanedCep = cep.replace(/\D/g, '');
    if (cleanedCep.length !== 8) {
      toast({ 
        title: "CEP Inválido", 
        description: "Por favor, insira um CEP com 8 dígitos.", 
        variant: "destructive" 
      });
      return;
    }
    
    setCepErrorApi(null);
    setIsCepLoading(true);
    
    try {
      // Mudar para BrasilAPI como nas outras implementações
      const response = await fetch(`https://brasilapi.com.br/api/cep/v2/${cleanedCep}`);
      const data = await response.json();
      
      if (!response.ok || data.type === 'service_error' || data.name === 'NotFoundError') {
        const errorMessage = data.message || (data.errors && data.errors[0]?.message) || 'CEP não encontrado ou erro na API.';
        throw new Error(errorMessage);
      }
      
      form.setValue('endereco_logradouro', data.street || '', { shouldValidate: true });
      form.setValue('endereco_bairro', data.neighborhood || '', { shouldValidate: true });
      form.setValue('endereco_cidade', data.city || '', { shouldValidate: true });
      form.setValue('endereco_estado', data.state || '', { shouldValidate: true });
      
      // Focar no campo número após preenchimento
      setTimeout(() => {
        const numeroInput = document.querySelector('input[name="endereco_numero"]') as HTMLInputElement;
        if (numeroInput) numeroInput.focus();
      }, 100);
      
      toast({ 
        title: "CEP encontrado!", 
        description: "Endereço preenchido automaticamente.",
      });
    } catch (error: unknown) {
      console.error('Erro ao buscar CEP:', error);
      const message = error instanceof Error ? error.message : "Falha ao consultar CEP.";
      setCepErrorApi(message);
      toast({ 
        title: "Erro na Consulta de CEP", 
        description: message, 
        variant: "destructive" 
      });
    } finally {
      setIsCepLoading(false);
    }
  };

  // Handler para mudança de CEP (agora como alias para fetch)
  const handleCepChange = () => {
    const cep = form.getValues('endereco_cep');
    if (cep) {
      fetchAddressByCep(cep);
    }
  };
  
  // Efeito para buscar CEP quando for alterado e tiver 8 dígitos
  useEffect(() => {
    const cleanedCep = cepValue?.replace(/\D/g, '');
    if (cleanedCep && cleanedCep.length === 8 && form.getFieldState('endereco_cep').isDirty) {
      fetchAddressByCep(cepValue);
    }
  }, [cepValue, form]);

  const onFormError = (errors: any) => {
    console.error("Erros de validação do formulário detectados:", errors);
    toast({
      title: "Campos Inválidos",
      description: "Por favor, corrija os campos destacados em vermelho.",
      variant: "destructive",
    });
  };

  // Submissão do formulário
  const onSubmit = async (values: PlantaSolarFormValues) => {
    // lógica original restaurada:
    console.log("onSubmit: Função iniciada", values);

    if (!user) {
      console.error("onSubmit: Usuário não autenticado, retornando.");
      toast({
        title: "Erro de Autenticação",
        description: "Você precisa estar logado para realizar esta ação.",
        variant: "destructive",
      });
      return;
    }
    console.log("onSubmit: Usuário autenticado", user.id);

    // Combinar ano_instalacao e mes_dia_instalacao para formar a data_instalacao completa
    let dataInstalacaoFinal: Date | null = null;
    console.log("onSubmit: Tentando criar dataInstalacaoFinal. Ano:", values.ano_instalacao, "Mês/Dia:", values.mes_dia_instalacao);
    if (values.ano_instalacao && values.mes_dia_instalacao) {
      dataInstalacaoFinal = new Date(values.mes_dia_instalacao);
      dataInstalacaoFinal.setFullYear(values.ano_instalacao);
      console.log("onSubmit: dataInstalacaoFinal criada com ano e mês/dia:", dataInstalacaoFinal);
    } else if (values.ano_instalacao && !values.mes_dia_instalacao) {
      console.warn("onSubmit: Ano de instalação fornecido, mas mês/dia não. Retornando.");
       toast({ title: "Data Incompleta", description: "Se o ano de instalação for fornecido, o mês e dia também devem ser.", variant: "destructive"});
       return;
    } else if (!values.ano_instalacao && values.mes_dia_instalacao) {
      console.warn("onSubmit: Mês/Dia de instalação fornecido, mas ano não. Retornando.");
      toast({ title: "Data Incompleta", description: "Se o mês/dia de instalação for fornecido, o ano também deve ser.", variant: "destructive"});
      return;
    } else {
      console.log("onSubmit: Nem ano nem mês/dia de instalação fornecidos. dataInstalacaoFinal será null.");
    }

    try {
      console.log("onSubmit: Entrando no bloco try...");
      setLoading(true);
      
      const credencialAjustada = values.credencial_id === 'none' ? null : values.credencial_id;
      console.log("onSubmit: credencialAjustada:", credencialAjustada);
      
      const dataToSubmit = {
        ...values,
        proprietario_user_id: user.id,
        credencial_id: credencialAjustada,
        data_instalacao: dataInstalacaoFinal ? dataInstalacaoFinal.toISOString().split('T')[0] : null,
      };
      delete (dataToSubmit as any).ano_instalacao;
      delete (dataToSubmit as any).mes_dia_instalacao;
      
      // Mapeamento completo dos campos do formulário para colunas do banco de dados
      const mapeamentoCampos = {
        // Campos que devem ser removidos completamente
        area_ocupada_m2: null, // Não existe na tabela
        identificacao_concessionaria: null, // Não existe coluna direta em plantas_solares
        potencia_modulo_wp: null, // Não existe na tabela plantas_solares
        tipo_instalacao: null, // Não existe na tabela plantas_solares

        // Mappings for fields related to manufacturer and plant ID
        fabricante_inversor: 'sistema_externo_tipo', // Form enum (e.g., GROWATT) maps to this text column
        fabricante_planta_id: 'id_externo_planta',    // Form's plant ID on manufacturer platform
        
        // Mapeamento do nome das colunas
        nome_identificador: 'nome_planta', // Coluna na tabela é 'nome_planta'
        
        // Campos de endereço
        endereco_bairro: 'bairro',
        endereco_logradouro: 'logradouro',
        endereco_numero: 'numero_endereco', // Nome diferente na tabela
        endereco_complemento: 'complemento',
        endereco_cidade: 'cidade',
        endereco_estado: 'estado',
        endereco_cep: 'cep',
        
        // Outros campos
        numero_modulos: 'quantidade_modulos',
        potencia_pico_kwp: 'potencia_instalada_kwp', // Nome diferente na tabela
      };
      
      // Criar um novo objeto com os campos corretamente mapeados
      const dadosMapeados = { ...dataToSubmit };
      
      // Processar cada campo segundo o mapeamento
      for (const [campoFormulario, colunaBanco] of Object.entries(mapeamentoCampos)) {
        // Se o campo existe no dataToSubmit
        if (campoFormulario in dadosMapeados) {
          // Se colunaBanco for null, simplesmente remover o campo
          if (colunaBanco === null) {
            delete dadosMapeados[campoFormulario];
          } 
          // Caso contrário, mapear para o nome correto
          else {
            // Tratamento especial para o CEP: remover o hífen se existir e for mapeado para 'cep'
            if (colunaBanco === 'cep' && typeof dadosMapeados[campoFormulario] === 'string') {
              dadosMapeados[colunaBanco] = (dadosMapeados[campoFormulario] as string).replace(/\D/g, '');
            } else {
              dadosMapeados[colunaBanco] = dadosMapeados[campoFormulario];
            }
            // Apenas deletar se o nome do campo do formulário for diferente da coluna do banco
            if (campoFormulario !== colunaBanco) {
              delete dadosMapeados[campoFormulario];
            }
          }
        }
      }
      
      console.log("onSubmit: dataToSubmit após mapeamento:", dadosMapeados);
      
      if (isEditMode) {
        console.log("onSubmit: Modo de edição. ID:", id);
        // Update planta solar
        const { error } = await supabase
          .from('plantas_solares')
          .update({
            ...dadosMapeados,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .eq('proprietario_user_id', user.id);
        console.log("onSubmit (edição): Resposta do Supabase. Erro:", error);
          
        if (error) throw error;
        
        toast({
          title: 'Planta solar atualizada',
          description: 'Os dados da planta solar foram atualizados com sucesso.',
        });
      } else {
        console.log("onSubmit: Modo de criação.");
        // Create new planta solar
        const { error } = await supabase
          .from('plantas_solares')
          .insert([{ ...dadosMapeados, integracao_ativa: false, } ]); // Removido comentário de outros defaults
        console.log("onSubmit (criação): Resposta do Supabase. Erro:", error);
          
        if (error) throw error;
        
        toast({
          title: 'Planta solar cadastrada',
          description: 'A planta solar foi cadastrada com sucesso.',
        });
      }
      
      console.log("onSubmit: Operação bem-sucedida, navegando para /plantas-solares");
      navigate('/plantas-solares');
    } catch (error) {
      console.error('onSubmit: Erro capturado no bloco catch:', error);
      toast({
        title: 'Erro ao Salvar',
        description: (error instanceof Error ? error.message : 'Não foi possível salvar os dados da planta solar.'),
        variant: 'destructive',
      });
    } finally {
      console.log("onSubmit: Entrando no bloco finally. Setting loading to false.");
      setLoading(false);
    }
  };
  
  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 max-w-4xl">
      <Card className="shadow-lg">
        <CardHeader className="bg-gray-50 dark:bg-gray-800 p-4 md:p-6 rounded-t-lg">
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl md:text-3xl font-semibold text-gray-800 dark:text-white">
              {isEditMode ? 'Editar Planta Solar' : 'Cadastrar Nova Planta Solar'}
            </CardTitle>
            <Button variant="outline" size="icon" onClick={() => navigate('/plantas-solares')} aria-label="Voltar">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </div>
          {isEditMode && id && (
            <CardDescription className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              ID da Planta: {id}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          {initialLoading && isEditMode ? (
            <div className="flex justify-center items-center h-64">
              <Spinner size="lg" />
              <p className="ml-4 text-lg">Carregando dados da planta...</p>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit, onFormError)} className="space-y-8">
                <Accordion type="multiple" defaultValue={["dados-planta", "endereco-planta"]} className="w-full">
                  {/* Seção 1: Dados da Nova Planta Solar */}
                  <AccordionItem value="dados-planta">
                    <AccordionTrigger className="text-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 px-4 py-3 rounded-md">
                      Dados da Planta Solar
                    </AccordionTrigger>
                    <AccordionContent className="pt-4 pb-2 px-4 border-t dark:border-gray-700">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
                        <FormField
                          control={form.control}
                          name="nome_identificador"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nome/Identificador da Planta *</FormLabel>
                              <FormControl>
                                <Input placeholder="Ex: Usina Solar Residencial" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="apelido"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Apelido (Opcional)</FormLabel>
                              <FormControl>
                                <Input placeholder="Ex: Minha Usina Querida" {...field} value={field.value ?? ''} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="fabricante_inversor"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Fabricante do Inversor *</FormLabel>
                              <Select 
                                onValueChange={field.onChange} 
                                value={field.value || undefined}
                                defaultValue={field.value || undefined}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecione o fabricante" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {fabricanteInversorOptions.map(option => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
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
                          name="fabricante_planta_id"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nº de Série do Inversor / ID da Planta no Fabricante *</FormLabel>
                              <FormControl>
                                <Input placeholder="S/N do inversor ou ID na plataforma do fabricante" {...field} value={field.value ?? ''} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="ano_instalacao"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Ano de Instalação (Opcional)</FormLabel>
                              <Select
                                onValueChange={(value) => field.onChange(value ? parseInt(value) : null)}
                                value={field.value?.toString() ?? undefined}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecione o ano" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {anoOptions.map(option => (
                                    <SelectItem key={option.value} value={option.value.toString()}>
                                      {option.label}
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
                          name="mes_dia_instalacao"
                          render={({ field }) => (
                            <FormItem className="flex flex-col">
                              <FormLabel>Dia/Mês de Instalação (Opcional)</FormLabel>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button
                                      variant={"outline"}
                                      className={cn(
                                        "w-full pl-3 text-left font-normal",
                                        !field.value && "text-muted-foreground"
                                      )}
                                      disabled={!form.watch("ano_instalacao")}
                                    >
                                      {field.value ? (
                                        format(field.value, "dd 'de' MMMM")
                                      ) : (
                                        <span>Escolha o dia/mês</span>
                                      )}
                                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={field.value}
                                    onSelect={field.onChange}
                                    defaultMonth={
                                      field.value
                                        ? new Date(form.watch("ano_instalacao")!, field.value.getMonth(), 1)
                                        : form.watch("ano_instalacao")
                                          ? new Date(form.watch("ano_instalacao")!, new Date().getMonth(), 1)
                                          : new Date()
                                    }
                                    disabled={(date) => {
                                      const selectedAno = form.watch("ano_instalacao");
                                      if (!selectedAno) return true;
                                      return date.getFullYear() !== selectedAno || date > new Date() || date < new Date("1900-01-01");
                                    }}
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
                          name="credencial_id"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Credencial de Integração (Opcional)</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value ?? 'none'} defaultValue={field.value ?? 'none'}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder={loadingCredentials ? "Carregando..." : "Selecione a credencial"} />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {loadingCredentials ? (
                                    <SelectItem value="loading" disabled>Carregando...</SelectItem>
                                  ) : (
                                    <>
                                      <SelectItem value="none">Nenhuma</SelectItem>
                                      {filteredCredentials.map((cred) => (
                                        <SelectItem key={cred.id} value={cred.id}>
                                          {cred.nome_referencia} ({cred.fabricante_nome})
                                        </SelectItem>
                                      ))}
                                    </>
                                  )}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="status_planta"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Status da Planta *</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecione o status" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {Object.values(StatusPlantaSolar).map((status) => (
                                    <SelectItem key={status} value={status}>
                                      {status.replace(/_/g, ' ')}
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
                          name="identificacao_concessionaria"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nº UC na Concessionária (Opcional)</FormLabel>
                              <FormControl>
                                <Input placeholder="Ex: 7001234567" {...field} value={field.value ?? ''} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Seção 2: Endereço da Planta */}
                  <AccordionItem value="endereco-planta">
                    <AccordionTrigger className="text-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 px-4 py-3 rounded-md">
                        Endereço da Planta
                    </AccordionTrigger>
                    <AccordionContent className="pt-4 pb-2 px-4 border-t dark:border-gray-700">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-6">
                        <FormField
                          control={form.control}
                          name="endereco_cep"
                          render={({ field }) => (
                            <FormItem className="md:col-span-1">
                              <FormLabel>CEP *</FormLabel>
                              <div className="flex items-center space-x-2">
                                <FormControl>
                                  <Input 
                                    placeholder="00000-000" 
                                    {...field} 
                                    value={field.value ?? ''}
                                    onChange={(e) => {
                                      const cep = e.target.value.replace(/\D/g, '');
                                      if (cep.length <= 8) {
                                        field.onChange(cep.replace(/^(\d{5})(\d{3})$/, '$1-$2'));
                                      }
                                    }}
                                    onBlur={handleCepChange} 
                                  />
                                </FormControl>
                                {isCepLoading && <Spinner size="sm" />}
                              </div>
                              {cepErrorApi && <p className="text-sm text-red-500 mt-1">{cepErrorApi}</p>}
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="endereco_logradouro"
                          render={({ field }) => (
                            <FormItem className="lg:col-span-2">
                              <FormLabel>Logradouro *</FormLabel>
                              <FormControl>
                                <Input placeholder="Ex: Rua das Palmeiras" {...field} value={field.value ?? ''} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="endereco_numero"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Número *</FormLabel>
                              <FormControl>
                                <Input placeholder="Ex: 123" {...field} value={field.value ?? ''} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="endereco_complemento"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Complemento (Opcional)</FormLabel>
                              <FormControl>
                                <Input placeholder="Ex: Apto 101, Bloco B" {...field} value={field.value ?? ''} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="endereco_bairro"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Bairro *</FormLabel>
                              <FormControl>
                                <Input placeholder="Ex: Centro" {...field} value={field.value ?? ''} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="endereco_cidade"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Cidade *</FormLabel>
                              <FormControl>
                                <Input placeholder="Ex: Florianópolis" {...field} value={field.value ?? ''} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="endereco_estado"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>UF *</FormLabel>
                              <FormControl>
                                <Input placeholder="Ex: SC" {...field} maxLength={2} value={field.value ?? ''} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                         <FormField
                            control={form.control}
                            name="latitude"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Latitude (Opcional)</FormLabel>
                                <FormControl>
                                  <Input type="number" step="any" placeholder="-27.5969" {...field} value={field.value ?? ''} />
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
                                <FormLabel>Longitude (Opcional)</FormLabel>
                                <FormControl>
                                  <Input type="number" step="any" placeholder="-48.5495" {...field} value={field.value ?? ''} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                  
                  {/* Seção 3: Informações sobre o Sistema e Equipamentos (Opcional) */}
                  <AccordionItem value="info-sistema">
                    <AccordionTrigger className="text-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 px-4 py-3 rounded-md">
                        Informações sobre o Sistema e Equipamentos (Opcional)
                    </AccordionTrigger>
                    <AccordionContent className="pt-4 pb-2 px-4 border-t dark:border-gray-700">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-6">
                        <FormField
                          control={form.control}
                          name="tipo_sistema"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Tipo de Sistema (Opcional)</FormLabel>
                               <Select onValueChange={field.onChange} value={field.value ?? undefined} defaultValue={field.value ?? undefined}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecione o tipo de sistema" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {Object.values(TipoSistemaPlantaSolar).map((tipo) => (
                                    <SelectItem key={tipo} value={tipo}>
                                      {tipo.replace(/_/g, ' ')}
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
                          name="numero_modulos"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Número de Módulos</FormLabel>
                              <FormControl>
                                <Input type="number" placeholder="Ex: 10" {...field} value={field.value ?? ''} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="potencia_modulo_wp"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Potência do Módulo (Wp)</FormLabel>
                              <FormControl>
                                <Input type="number" step="0.1" placeholder="Ex: 450" {...field} value={field.value ?? ''} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="potencia_inversor_kw"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Potência do Inversor (kW)</FormLabel>
                              <FormControl>
                                <Input type="number" step="0.01" placeholder="Ex: 5" {...field} value={field.value ?? ''} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="potencia_pico_kwp"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Potência de Pico Instalada (kWp) *</FormLabel>
                              <FormControl>
                                <Input type="number" step="0.01" placeholder="Ex: 5.5" {...field} value={field.value ?? ''} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                         <FormField
                            control={form.control}
                            name="modelo_inversor"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Modelo do Inversor (Opcional)</FormLabel>
                                <FormControl>
                                  <Input placeholder="Ex: GROWATT-5000TL-XH" {...field} value={field.value ?? ''} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Seção Opcional para Observações */}
                   <AccordionItem value="observacoes-gerais">
                    <AccordionTrigger className="text-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 px-4 py-3 rounded-md">
                        Observações Gerais (Opcional)
                    </AccordionTrigger>
                    <AccordionContent className="pt-4 pb-2 px-4 border-t dark:border-gray-700">
                        <FormField
                            control={form.control}
                            name="observacoes"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Observações</FormLabel>
                                <FormControl>
                                <Textarea
                                    placeholder="Adicione quaisquer observações relevantes sobre a planta solar, instalação, ou cliente."
                                    className="resize-y min-h-[100px]"
                                    {...field}
                                    value={field.value ?? ''}
                                />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                <div className="flex justify-end space-x-3 pt-6">
                  <Button type="button" variant="outline" onClick={() => navigate('/plantas-solares')} disabled={loading}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={loading || initialLoading} className="min-w-[120px]">
                    {loading ? <Spinner size="sm" /> : (isEditMode ? <><Save className="mr-2 h-4 w-4" /> Salvar Alterações</> : <><Save className="mr-2 h-4 w-4" /> Cadastrar Planta</>)}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Função auxiliar para classes condicionais
const cn = (...classes: (string | boolean | undefined)[]) => {
  return classes.filter(Boolean).join(' ');
}; 