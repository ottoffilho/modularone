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
import { CalendarIcon, ArrowLeft, Save } from 'lucide-react';
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

// Schema para validação do formulário
const plantaSolarSchema = z.object({
  nome_identificador: z.string().min(3, "O nome da planta solar é obrigatório e deve ter no mínimo 3 caracteres."),
  apelido: z.string().optional().nullable(),
  identificacao_concessionaria: z.string().optional().nullable(),
  endereco_cep: z.string().regex(/^\d{5}-\d{3}$/, "CEP inválido").optional().nullable(),
  endereco_logradouro: z.string().optional().nullable(),
  endereco_numero: z.string().optional().nullable(),
  endereco_bairro: z.string().optional().nullable(),
  endereco_cidade: z.string().optional().nullable(),
  endereco_estado: z.string().length(2, "UF deve ter 2 caracteres").optional().nullable(),
  latitude: z.preprocess(
    (val) => (typeof val === 'string' ? String(val).replace(',', '.') : val),
    z.coerce.number().min(-90, "Latitude inválida").max(90, "Latitude inválida").optional().nullable()
  ),
  longitude: z.preprocess(
    (val) => (typeof val === 'string' ? String(val).replace(',', '.') : val),
    z.coerce.number().min(-180, "Longitude inválida").max(180, "Longitude inválida").optional().nullable()
  ),
  potencia_pico_kwp: z.preprocess(
    (val) => (typeof val === 'string' ? String(val).replace(',', '.') : val),
    z.coerce.number().positive("A potência instalada deve ser um número positivo.")
  ),
  data_instalacao: z.date().optional().nullable(),
  status_planta: z.enum(['ATIVA', 'INATIVA', 'MANUTENCAO', 'PLANEJAMENTO'], { 
    required_error: "Selecione o status da planta" 
  }).default('ATIVA'),
  observacoes: z.string().optional().nullable(),
  tipo_sistema: z.enum(['ON_GRID', 'OFF_GRID', 'HIBRIDO'], { 
    required_error: "Selecione o tipo de sistema" 
  }).optional().nullable(),
  potencia_inversor_kw: z.preprocess(
    (val) => String(val || '').replace(',', '.'), 
    z.coerce.number().positive("Deve ser positivo").optional().nullable()
  ),
  fabricante_inversor_id: z.string().uuid("ID de fabricante inválido").optional().nullable(),
  modelo_inversor: z.string().optional().nullable(),
  numero_serie_inversor: z.string().optional().nullable(),
  fabricante_modulos_id: z.string().uuid("ID de fabricante inválido").optional().nullable(),
  modelo_modulos: z.string().optional().nullable(),
  numero_serie_modulos: z.string().optional().nullable(),
  quantidade_modulos: z.coerce.number().int().positive("Deve ser inteiro positivo").optional().nullable(),
  empresa_instaladora_id: z.string().uuid("ID de empresa inválido").optional().nullable(),
});

// Tipo derivado do schema
type PlantaSolarFormValues = z.infer<typeof plantaSolarSchema>;

export default function PlantaSolarForm() {
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;
  
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditMode);
  const [isCepLoading, setIsCepLoading] = useState(false);
  
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const form = useForm<PlantaSolarFormValues>({
    resolver: zodResolver(plantaSolarSchema),
    defaultValues: {
      nome_identificador: '',
      apelido: null,
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
      data_instalacao: null,
      status_planta: 'ATIVA',
      observacoes: null,
      tipo_sistema: null,
      potencia_inversor_kw: null,
      fabricante_inversor_id: null,
      modelo_inversor: null,
      numero_serie_inversor: null,
      fabricante_modulos_id: null,
      modelo_modulos: null,
      numero_serie_modulos: null,
      quantidade_modulos: null,
      empresa_instaladora_id: null,
    },
  });

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
        const dataInstalacao = data.data_instalacao ? new Date(data.data_instalacao) : null;
        
        // Set form values
        form.reset({
          nome_identificador: data.nome_identificador || '',
          apelido: data.apelido,
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
          data_instalacao: dataInstalacao,
          status_planta: data.status_planta || 'ATIVA',
          observacoes: data.observacoes,
          tipo_sistema: data.tipo_sistema,
          potencia_inversor_kw: data.potencia_inversor_kw,
          fabricante_inversor_id: data.fabricante_inversor_id,
          modelo_inversor: data.modelo_inversor,
          numero_serie_inversor: data.numero_serie_inversor,
          fabricante_modulos_id: data.fabricante_modulos_id,
          modelo_modulos: data.modelo_modulos,
          numero_serie_modulos: data.numero_serie_modulos,
          quantidade_modulos: data.quantidade_modulos,
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

  // Função para buscar endereço pelo CEP
  const fetchAddressByCep = async (cep: string) => {
    if (!cep || !cep.match(/^\d{5}-\d{3}$/)) return;
    
    try {
      setIsCepLoading(true);
      
      const response = await fetch(`https://viacep.com.br/ws/${cep.replace('-', '')}/json/`);
      const data = await response.json();
      
      if (data.erro) {
        toast({
          title: 'CEP não encontrado',
          description: 'Não foi possível encontrar o endereço para o CEP informado.',
          variant: 'destructive',
        });
        return;
      }
      
      form.setValue('endereco_logradouro', data.logradouro);
      form.setValue('endereco_bairro', data.bairro);
      form.setValue('endereco_cidade', data.localidade);
      form.setValue('endereco_estado', data.uf);
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível consultar o CEP.',
        variant: 'destructive',
      });
    } finally {
      setIsCepLoading(false);
    }
  };

  // Handler para mudança de CEP
  const handleCepChange = (e: React.FocusEvent<HTMLInputElement>) => {
    const cep = e.target.value;
    if (cep) {
      fetchAddressByCep(cep);
    }
  };

  // Submissão do formulário
  const onSubmit = async (values: PlantaSolarFormValues) => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Prepare data object with correct database column names
      const dataToSubmit = {
        nome_identificador: values.nome_identificador,
        apelido: values.apelido,
        identificacao_concessionaria: values.identificacao_concessionaria,
        endereco_cep: values.endereco_cep,
        endereco_logradouro: values.endereco_logradouro,
        endereco_numero: values.endereco_numero,
        endereco_bairro: values.endereco_bairro,
        endereco_cidade: values.endereco_cidade,
        endereco_estado: values.endereco_estado,
        latitude: values.latitude,
        longitude: values.longitude,
        potencia_pico_kwp: values.potencia_pico_kwp,
        data_instalacao: values.data_instalacao,
        status_planta: values.status_planta,
        observacoes: values.observacoes,
        tipo_sistema: values.tipo_sistema,
        potencia_inversor_kw: values.potencia_inversor_kw,
        fabricante_inversor_id: values.fabricante_inversor_id,
        modelo_inversor: values.modelo_inversor,
        numero_serie_inversor: values.numero_serie_inversor,
        fabricante_modulos_id: values.fabricante_modulos_id,
        modelo_modulos: values.modelo_modulos,
        numero_serie_modulos: values.numero_serie_modulos,
        quantidade_modulos: values.quantidade_modulos,
        empresa_instaladora_id: values.empresa_instaladora_id,
      };

      if (isEditMode) {
        // Update planta solar
        const { error } = await supabase
          .from('plantas_solares')
          .update({
            ...dataToSubmit,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .eq('proprietario_user_id', user.id);
          
        if (error) throw error;
        
        toast({
          title: 'Planta solar atualizada',
          description: 'Os dados da planta solar foram atualizados com sucesso.',
        });
      } else {
        // Create new planta solar
        const { error } = await supabase
          .from('plantas_solares')
          .insert([{
            ...dataToSubmit,
            proprietario_user_id: user.id,
            integracao_ativa: false,
            credencial_id: null,
          }]);
          
        if (error) throw error;
        
        toast({
          title: 'Planta solar cadastrada',
          description: 'A planta solar foi cadastrada com sucesso.',
        });
      }
      
      navigate('/plantas-solares');
    } catch (error) {
      console.error('Erro ao salvar planta solar:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar os dados da planta solar.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isEditMode ? 'Editar' : 'Nova'} Planta Solar
          </h1>
          <p className="text-muted-foreground mt-2">
            {isEditMode 
              ? 'Atualize os dados da planta solar.' 
              : 'Cadastre uma nova planta solar.'}
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => navigate('/plantas-solares')}
          disabled={loading}
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
      </div>
      
      {initialLoading ? (
        <div className="flex justify-center py-8">
          <Spinner size="lg" />
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">
              {isEditMode ? 'Dados da Planta Solar' : 'Dados da Nova Planta Solar'}
            </CardTitle>
            <CardDescription>
              Preencha os campos abaixo com os dados da planta solar. Campos com * são obrigatórios.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Nome da Planta */}
                  <FormField
                    control={form.control}
                    name="nome_identificador"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome da Planta *</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Usina Solar ABC" {...field} value={field.value ?? ''} />
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
                        <FormLabel>Apelido</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Solar Principal" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Identificação Concessionária */}
                  <FormField
                    control={form.control}
                    name="identificacao_concessionaria"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Identificação na Concessionária</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Código fornecido pela concessionária" 
                            {...field} 
                            value={field.value || ''}
                            onChange={(e) => field.onChange(e.target.value || null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Status da Planta */}
                  <FormField
                    control={form.control}
                    name="status_planta"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status da Planta *</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o status da planta" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="ATIVA">ATIVA</SelectItem>
                            <SelectItem value="INATIVA">INATIVA</SelectItem>
                            <SelectItem value="MANUTENCAO">MANUTENÇÃO</SelectItem>
                            <SelectItem value="PLANEJAMENTO">PLANEJAMENTO</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Potência Instalada */}
                  <FormField
                    control={form.control}
                    name="potencia_pico_kwp"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Potência Instalada (kWp) *</FormLabel>
                        <FormControl>
                          <Input 
                            type="text" 
                            placeholder="Ex: 5.5"
                            {...field}
                            value={field.value === undefined ? '' : field.value}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Data de Conexão */}
                  <FormField
                    control={form.control}
                    name="data_instalacao"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Data de Conexão à Rede</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(field.value, "dd/MM/yyyy")
                                ) : (
                                  <span>Selecione a data</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value || undefined}
                              onSelect={(date) => field.onChange(date)}
                              disabled={(date) => date > new Date()}
                              initialFocus
                            />
                            <div className="p-3 border-t border-border flex justify-between">
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => field.onChange(null)}
                              >
                                Limpar
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => field.onChange(new Date())}
                              >
                                Hoje
                              </Button>
                            </div>
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Coordenadas */}
                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="latitude"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Latitude</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Ex: -23.550520"
                              {...field}
                              value={field.value === null ? '' : field.value}
                              onChange={(e) => {
                                const value = e.target.value === '' ? null : e.target.value;
                                field.onChange(value);
                              }}
                            />
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
                            <Input 
                              placeholder="Ex: -46.633308"
                              {...field}
                              value={field.value === null ? '' : field.value}
                              onChange={(e) => {
                                const value = e.target.value === '' ? null : e.target.value;
                                field.onChange(value);
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
                
                {/* Seção de Endereço */}
                <div className="pt-4 mt-4 border-t border-muted">
                  <h3 className="text-lg font-semibold mb-4">Endereço da Planta</h3>
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
                    <div className="md:col-span-2">
                      <FormField
                        control={form.control}
                        name="endereco_cep"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CEP</FormLabel>
                            <div className="flex gap-2">
                              <FormControl>
                                <Input 
                                  placeholder="00000-000"
                                  {...field}
                                  value={field.value || ''}
                                  onChange={(e) => field.onChange(e.target.value || null)}
                                  onBlur={handleCepChange}
                                  disabled={isCepLoading}
                                />
                              </FormControl>
                              {isCepLoading && <Spinner size="sm" className="mt-3" />}
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="md:col-span-4">
                      <FormField
                        control={form.control}
                        name="endereco_logradouro"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Logradouro</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Rua, Avenida, etc"
                                {...field}
                                value={field.value || ''}
                                onChange={(e) => field.onChange(e.target.value || null)}
                                disabled={isCepLoading}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <FormField
                        control={form.control}
                        name="endereco_numero"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Número</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="123"
                                {...field}
                                value={field.value || ''}
                                onChange={(e) => field.onChange(e.target.value || null)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="md:col-span-4">
                      <FormField
                        control={form.control}
                        name="endereco_bairro"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bairro</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Bairro"
                                {...field}
                                value={field.value || ''}
                                onChange={(e) => field.onChange(e.target.value || null)}
                                disabled={isCepLoading}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="md:col-span-3">
                      <FormField
                        control={form.control}
                        name="endereco_cidade"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cidade</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Cidade"
                                {...field}
                                value={field.value || ''}
                                onChange={(e) => field.onChange(e.target.value || null)}
                                disabled={isCepLoading}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="md:col-span-3">
                      <FormField
                        control={form.control}
                        name="endereco_estado"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Estado (UF)</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="UF"
                                {...field}
                                value={field.value || ''}
                                onChange={(e) => field.onChange(e.target.value || null)}
                                maxLength={2}
                                disabled={isCepLoading}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </div>
                
                {/* Observações */}
                <FormField
                  control={form.control}
                  name="observacoes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observações</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Informações adicionais sobre a planta solar"
                          className="resize-none min-h-[100px]"
                          {...field}
                          value={field.value || ''}
                          onChange={(e) => field.onChange(e.target.value || null)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="flex justify-end">
                  <Button 
                    type="submit" 
                    disabled={loading}
                    className="min-w-[120px]"
                  >
                    {loading ? (
                      <>
                        <Spinner className="mr-2" /> Salvando...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" /> Salvar
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="flex justify-between border-t pt-5 text-sm text-muted-foreground">
            <div>
              {isEditMode && `Última atualização: ${new Date().toLocaleDateString()}`}
            </div>
          </CardFooter>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Informações sobre o Sistema e Equipamentos</CardTitle>
          <CardDescription>
            Informações sobre o sistema e equipamentos da planta solar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="tipo_sistema"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Sistema</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value ?? undefined} value={field.value ?? undefined}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="ON_GRID">On-Grid (Conectado à Rede)</SelectItem>
                      <SelectItem value="OFF_GRID">Off-Grid (Isolado)</SelectItem>
                      <SelectItem value="HIBRIDO">Híbrido</SelectItem>
                    </SelectContent>
                  </Select>
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
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="fabricante_inversor_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fabricante do Inversor</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value ?? undefined} value={field.value ?? undefined}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o fabricante" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {/* TODO: Popular com dados de fabricantes_equipamentos */}
                      <SelectItem value="dummy-inv-1">Fabricante Inversor A (Dummy)</SelectItem>
                      <SelectItem value="dummy-inv-2">Fabricante Inversor B (Dummy)</SelectItem>
                      <SelectItem value={null as any}>Nenhum/Não Informado</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="modelo_inversor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Modelo do Inversor</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: SUN-5K-G" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="numero_serie_inversor"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Número de Série do Inversor</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: 12345ABC" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <hr className="my-6" />

          <div className="grid md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="fabricante_modulos_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fabricante dos Módulos</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value ?? undefined} value={field.value ?? undefined}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o fabricante" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {/* TODO: Popular com dados de fabricantes_equipamentos */}
                      <SelectItem value="dummy-mod-1">Fabricante Módulo X (Dummy)</SelectItem>
                      <SelectItem value="dummy-mod-2">Fabricante Módulo Y (Dummy)</SelectItem>
                      <SelectItem value={null as any}>Nenhum/Não Informado</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="modelo_modulos"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Modelo dos Módulos</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: CS3W-450MS" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="quantidade_modulos"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantidade de Módulos</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="Ex: 10" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
                control={form.control}
                name="numero_serie_modulos"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Números de Série dos Módulos</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Liste os números de série, um por linha ou separados por vírgula" {...field} value={field.value ?? ''} />
                    </FormControl>
                     <FormMessage />
                  </FormItem>
                )}
              />
          </div>
          
          <hr className="my-6" />

          <FormField
            control={form.control}
            name="empresa_instaladora_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Empresa Instaladora</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value ?? undefined} value={field.value ?? undefined}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a empresa" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {/* TODO: Popular com dados da tabela de empresas/clientes */}
                    <SelectItem value="dummy-emp-1">Instaladora XPTO (Dummy)</SelectItem>
                    <SelectItem value={null as any}>Nenhuma/Não Informada</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>
    </div>
  );
}

// Função auxiliar para classes condicionais
const cn = (...classes: (string | boolean | undefined)[]) => {
  return classes.filter(Boolean).join(' ');
}; 