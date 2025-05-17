
import { useState, useEffect } from 'react';
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

// Schema for validating UC data
const ucSchema = z.object({
  identificador: z.string().min(3, 'Identificador deve ter pelo menos 3 caracteres'),
  endereco: z.string().min(5, 'Endereço deve ter pelo menos 5 caracteres'),
  distribuidora: z.string().min(2, 'Nome da distribuidora é obrigatório'),
  cliente_id: z.string().optional(),
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
  
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const form = useForm<UCFormValues>({
    resolver: zodResolver(ucSchema),
    defaultValues: {
      identificador: '',
      endereco: '',
      distribuidora: '',
      cliente_id: clienteIdFromQuery || undefined,
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
          .eq('user_id', user.id)
          .order('nome_razao_social');
          
        if (clientesError) throw clientesError;
        
        setClientes(clientesData || []);
        
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
            distribuidora: ucData.distribuidora,
            cliente_id: ucData.cliente_id || undefined,
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
      
      if (isEditMode) {
        // Update existing UC
        const { error } = await supabase
          .from('unidades_consumidoras')
          .update({
            identificador: values.identificador,
            endereco: values.endereco,
            distribuidora: values.distribuidora,
            cliente_id: values.cliente_id || null,
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
            distribuidora: values.distribuidora,
            cliente_id: values.cliente_id || null,
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

  if (initialLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Button
          variant="ghost"
          className="mb-2"
          onClick={() => clienteIdFromQuery 
            ? navigate(`/clientes/${clienteIdFromQuery}`) 
            : navigate('/ucs')
          }
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">
          {isEditMode ? 'Editar Unidade Consumidora' : 'Nova Unidade Consumidora'}
        </h1>
        <p className="text-muted-foreground mt-2">
          {isEditMode
            ? 'Edite as informações da unidade consumidora.'
            : 'Preencha os dados para cadastrar uma nova unidade consumidora.'}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informações da Unidade Consumidora</CardTitle>
          <CardDescription>
            Preencha os dados da unidade consumidora. Campos marcados com * são obrigatórios.
          </CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="identificador"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Identificador / Número da UC *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Número da unidade consumidora" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="endereco"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Endereço *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Endereço completo da unidade consumidora" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="distribuidora"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Distribuidora de Energia *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Nome da distribuidora/concessionária" />
                    </FormControl>
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
                      onValueChange={field.onChange}
                      value={field.value}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um cliente" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">Nenhum cliente</SelectItem>
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
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => clienteIdFromQuery 
                  ? navigate(`/clientes/${clienteIdFromQuery}`) 
                  : navigate('/ucs')
                }
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>Salvando...</>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Salvar
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
