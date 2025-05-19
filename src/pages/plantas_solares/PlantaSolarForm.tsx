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
  nome: z.string().min(3, "O nome da planta solar é obrigatório e deve ter no mínimo 3 caracteres."),
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
  potencia_instalada_dc_kwp: z.preprocess(
    (val) => (typeof val === 'string' ? String(val).replace(',', '.') : val),
    z.coerce.number().positive("A potência instalada deve ser um número positivo.")
  ),
  data_conexao_rede: z.date().optional().nullable(),
  status_planta: z.enum(['ATIVA', 'INATIVA', 'MANUTENCAO', 'PLANEJAMENTO'], { 
    required_error: "Selecione o status da planta" 
  }).default('ATIVA'),
  observacoes: z.string().optional().nullable(),
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
      nome: '',
      identificacao_concessionaria: null,
      endereco_cep: null,
      endereco_logradouro: null,
      endereco_numero: null,
      endereco_bairro: null,
      endereco_cidade: null,
      endereco_estado: null,
      latitude: null,
      longitude: null,
      potencia_instalada_dc_kwp: undefined,
      data_conexao_rede: null,
      status_planta: 'ATIVA',
      observacoes: null,
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
          .eq('user_id', user.id)
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
        const dataConexao = data.data_conexao_rede ? new Date(data.data_conexao_rede) : null;
        
        // Set form values
        form.reset({
          nome: data.nome || '',
          identificacao_concessionaria: data.identificacao_concessionaria,
          endereco_cep: data.endereco_cep,
          endereco_logradouro: data.endereco_logradouro,
          endereco_numero: data.endereco_numero,
          endereco_bairro: data.endereco_bairro,
          endereco_cidade: data.endereco_cidade,
          endereco_estado: data.endereco_estado,
          latitude: data.latitude,
          longitude: data.longitude,
          potencia_instalada_dc_kwp: data.potencia_instalada_dc_kwp,
          data_conexao_rede: dataConexao,
          status_planta: data.status_planta || 'ATIVA',
          observacoes: data.observacoes,
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
  }, [isEditMode, id, user]);

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
      
      if (isEditMode) {
        // Update planta solar
        const { error } = await supabase
          .from('plantas_solares')
          .update({
            nome: values.nome,
            identificacao_concessionaria: values.identificacao_concessionaria,
            endereco_cep: values.endereco_cep,
            endereco_logradouro: values.endereco_logradouro,
            endereco_numero: values.endereco_numero,
            endereco_bairro: values.endereco_bairro,
            endereco_cidade: values.endereco_cidade,
            endereco_estado: values.endereco_estado,
            latitude: values.latitude,
            longitude: values.longitude,
            potencia_instalada_dc_kwp: values.potencia_instalada_dc_kwp,
            data_conexao_rede: values.data_conexao_rede,
            status_planta: values.status_planta,
            observacoes: values.observacoes,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .eq('user_id', user.id);
          
        if (error) throw error;
        
        toast({
          title: 'Planta solar atualizada',
          description: 'Os dados da planta solar foram atualizados com sucesso.',
        });
      } else {
        // Create new planta solar
        const { error } = await supabase
          .from('plantas_solares')
          .insert({
            nome: values.nome,
            identificacao_concessionaria: values.identificacao_concessionaria,
            endereco_cep: values.endereco_cep,
            endereco_logradouro: values.endereco_logradouro,
            endereco_numero: values.endereco_numero,
            endereco_bairro: values.endereco_bairro,
            endereco_cidade: values.endereco_cidade,
            endereco_estado: values.endereco_estado,
            latitude: values.latitude,
            longitude: values.longitude,
            potencia_instalada_dc_kwp: values.potencia_instalada_dc_kwp,
            data_conexao_rede: values.data_conexao_rede,
            status_planta: values.status_planta,
            observacoes: values.observacoes,
            user_id: user.id,
            created_at: new Date().toISOString(),
          });
          
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
                    name="nome"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome da Planta *</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Usina Solar ABC" {...field} />
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
                    name="potencia_instalada_dc_kwp"
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
                    name="data_conexao_rede"
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
    </div>
  );
}

// Função auxiliar para classes condicionais
const cn = (...classes: (string | boolean | undefined)[]) => {
  return classes.filter(Boolean).join(' ');
}; 