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

// Schema for validating UC data
const ucSchema = z.object({
  identificador: z.string().min(3, 'Identificador deve ter pelo menos 3 caracteres'),
  endereco: z.string().min(5, 'Endereço deve ter pelo menos 5 caracteres'),
  distribuidora_id: z.string({ required_error: "Selecione uma distribuidora" }),
  cliente_id: z.string().optional().or(z.literal('none')),
  tipo: z.enum(['Geradora', 'Consumidora Remota', 'Consumidora Local'], { required_error: "Selecione o tipo da UC" }),
  fonte_dados: z.enum(['SAJ', 'Growatt', 'Manual', 'Outra'], { required_error: "Selecione a fonte de dados" }),
  planta_solar_id: z.string().uuid("ID da planta solar inválido").optional().or(z.literal('none')),
});

type UCFormValues = z.infer<typeof ucSchema>;

export default function UCForm() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const clienteIdFromQuery = queryParams.get('cliente');
  
  const isEditMode = !!id;
  
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [distribuidorasList, setDistribuidorasList] = useState<Distribuidora[]>([]);
  const [plantasSolaresList, setPlantasSolaresList] = useState<PlantaSolar[]>([]);
  
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const form = useForm<UCFormValues>({
    resolver: zodResolver(ucSchema),
    defaultValues: {
      identificador: '',
      endereco: '',
      distribuidora_id: '',
      cliente_id: clienteIdFromQuery || 'none',
      tipo: undefined,
      fonte_dados: undefined,
      planta_solar_id: 'none',
    },
  });

  // Load clients list and UC data if in edit mode
  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      
      try {
        setInitialLoading(true);
        
        // Load clients list
        const { data: clientesData, error: clientesError } = await supabase
          .from('clientes')
          .select('id, nome_razao_social')
          .eq('proprietario_user_id', user.id)
          .order('nome_razao_social');
          
        if (clientesError) throw clientesError;
        
        setClientes(clientesData || []);
        
        // Load distribuidoras
        const { data: distribuidorasData, error: distribuidorasError } = await supabase
          .from('distribuidoras')
          .select('id, nome')
          .order('nome');
          
        if (distribuidorasError) throw distribuidorasError;
        
        setDistribuidorasList(distribuidorasData || []);
        
        // Load plantas solares
        const { data: plantasData, error: plantasError } = await supabase
          .from('plantas_solares')
          .select('id, nome_planta')
          .eq('proprietario_user_id', user.id)
          .order('nome_planta');
          
        if (plantasError) throw plantasError;
        
        setPlantasSolaresList(
          (plantasData || [])
            .filter(p => typeof p.id === 'string' && p.id.trim() !== '' && typeof p.nome_planta === 'string' && p.nome_planta.trim() !== '')
            .map(p => ({ id: p.id.trim(), nome_planta: p.nome_planta.trim() }))
        );
        
        // If edit mode, load UC data
        if (isEditMode) {
          const { data: ucData, error: ucError } = await supabase
            .from('unidades_consumidoras')
            .select('*')
            .eq('id', id)
            .eq('user_id', user.id)
            .single();
            
          if (ucError) throw ucError;
          
          if (!ucData) {
            toast({
              title: 'Unidade consumidora não encontrada',
              description: 'A UC que você está tentando editar não existe ou você não tem permissão para acessá-la.',
              variant: 'destructive',
            });
            navigate('/ucs');
            return;
          }
          
          // Set form values
          form.reset({
            identificador: ucData.identificador,
            endereco: ucData.endereco,
            distribuidora_id: ucData.distribuidora_id || undefined,
            cliente_id: ucData.cliente_id || 'none',
            tipo: ucData.tipo || undefined,
            fonte_dados: ucData.fonte_dados || undefined,
            planta_solar_id: ucData.planta_solar_id || 'none',
          });
        }
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
        toast({
          title: 'Erro',
          description: 'Não foi possível carregar os dados necessários.',
          variant: 'destructive',
        });
        navigate('/ucs');
      } finally {
        setInitialLoading(false);
      }
    };
    
    loadData();
  }, [isEditMode, id, user, clienteIdFromQuery]);

  const onSubmit = async (values: UCFormValues) => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Tratar valores "none" como null
      const cliente_id = values.cliente_id === 'none' ? null : values.cliente_id;
      const planta_solar_id = values.planta_solar_id === 'none' ? null : values.planta_solar_id;
      
      if (isEditMode) {
        // Update existing UC
        const { error } = await supabase
          .from('unidades_consumidoras')
          .update({
            identificador: values.identificador,
            endereco: values.endereco,
            distribuidora_id: values.distribuidora_id,
            cliente_id: cliente_id,
            tipo: values.tipo,
            fonte_dados: values.fonte_dados,
            planta_solar_id: planta_solar_id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .eq('user_id', user.id);
          
        if (error) throw error;
        
        toast({
          title: 'UC atualizada',
          description: 'Os dados da unidade consumidora foram atualizados com sucesso.',
        });
      } else {
        // Create new UC
        const { error } = await supabase
          .from('unidades_consumidoras')
          .insert({
            identificador: values.identificador,
            endereco: values.endereco,
            distribuidora_id: values.distribuidora_id,
            cliente_id: cliente_id,
            tipo: values.tipo,
            fonte_dados: values.fonte_dados,
            planta_solar_id: planta_solar_id,
            user_id: user.id,
            created_at: new Date().toISOString(),
          });
          
        if (error) throw error;
        
        toast({
          title: 'UC cadastrada',
          description: 'A unidade consumidora foi cadastrada com sucesso.',
        });
      }
      
      // Navigate back based on whether we came from a client page
      if (clienteIdFromQuery) {
        navigate(`/clientes/${clienteIdFromQuery}`);
      } else {
        navigate('/ucs');
      }
    } catch (error) {
      console.error('Erro ao salvar unidade consumidora:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar os dados da unidade consumidora.',
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
            {isEditMode ? 'Editar' : 'Nova'} Unidade Consumidora
          </h1>
          <p className="text-muted-foreground mt-2">
            {isEditMode 
              ? 'Atualize os dados da unidade consumidora.' 
              : 'Cadastre uma nova unidade consumidora.'}
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
      
      {initialLoading ? (
        <div className="flex justify-center py-8">
          <Spinner size="lg" />
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">
              {isEditMode ? 'Dados da UC' : 'Dados da nova UC'}
            </CardTitle>
            <CardDescription>
              Preencha os campos abaixo com os dados da unidade consumidora.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="identificador"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Identificador</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: UC 123456" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="tipo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de UC</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o tipo da UC" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Geradora">Geradora</SelectItem>
                            <SelectItem value="Consumidora Remota">Consumidora Remota</SelectItem>
                            <SelectItem value="Consumidora Local">Consumidora Local</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="endereco"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Endereço</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Rua das Flores, 123" {...field} />
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
                        <FormLabel>Distribuidora</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a distribuidora" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {distribuidorasList.map((distribuidora) => (
                              <SelectItem key={distribuidora.id} value={distribuidora.id}>
                                {distribuidora.nome}
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
                    name="cliente_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cliente (opcional)</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o cliente" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">Nenhum cliente</SelectItem>
                            {clientes.map((cliente) => (
                              <SelectItem key={cliente.id} value={cliente.id}>
                                {cliente.nome_razao_social}
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
                    name="fonte_dados"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fonte de Dados</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a fonte de dados" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="SAJ">SAJ</SelectItem>
                            <SelectItem value="Growatt">Growatt</SelectItem>
                            <SelectItem value="Manual">Manual</SelectItem>
                            <SelectItem value="Outra">Outra</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {form.watch('tipo') === 'Geradora' && (
                    <FormField
                      control={form.control}
                      name="planta_solar_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Planta Solar Associada (opcional)</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione a planta solar" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">Nenhuma planta solar</SelectItem>
                              {plantasSolaresList.map((planta) => (
                                <SelectItem key={planta.id} value={planta.id}>
                                  {planta.nome_planta}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
                
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