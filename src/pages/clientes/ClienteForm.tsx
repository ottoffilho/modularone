
import { useState, useEffect } from 'react';
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

// Schema for validating client data
const clienteSchema = z.object({
  nome_razao_social: z.string().min(3, 'Nome/Razão Social deve ter pelo menos 3 caracteres'),
  cpf_cnpj: z.string().min(11, 'CPF/CNPJ inválido'),
  contato: z.string().optional(),
});

type ClienteFormValues = z.infer<typeof clienteSchema>;

export default function ClienteForm() {
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;
  
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditMode);
  
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const form = useForm<ClienteFormValues>({
    resolver: zodResolver(clienteSchema),
    defaultValues: {
      nome_razao_social: '',
      cpf_cnpj: '',
      contato: '',
    },
  });

  // Load client data if in edit mode
  useEffect(() => {
    const loadCliente = async () => {
      if (!isEditMode || !user) return;
      
      try {
        setInitialLoading(true);
        
        const { data, error } = await supabase
          .from('clientes')
          .select('*')
          .eq('id', id)
          .eq('user_id', user.id)
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
        
        // Set form values
        form.reset({
          nome_razao_social: data.nome_razao_social,
          cpf_cnpj: data.cpf_cnpj,
          contato: data.contato || '',
        });
      } catch (error) {
        console.error('Erro ao carregar dados do cliente:', error);
        toast({
          title: 'Erro',
          description: 'Não foi possível carregar os dados do cliente.',
          variant: 'destructive',
        });
        navigate('/clientes');
      } finally {
        setInitialLoading(false);
      }
    };
    
    loadCliente();
  }, [isEditMode, id, user]);

  const onSubmit = async (values: ClienteFormValues) => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      if (isEditMode) {
        // Update existing client
        const { error } = await supabase
          .from('clientes')
          .update({
            nome_razao_social: values.nome_razao_social,
            cpf_cnpj: values.cpf_cnpj,
            contato: values.contato || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .eq('user_id', user.id);
          
        if (error) throw error;
        
        toast({
          title: 'Cliente atualizado',
          description: 'Os dados do cliente foram atualizados com sucesso.',
        });
      } else {
        // Create new client
        const { error } = await supabase
          .from('clientes')
          .insert({
            nome_razao_social: values.nome_razao_social,
            cpf_cnpj: values.cpf_cnpj,
            contato: values.contato || null,
            user_id: user.id,
            created_at: new Date().toISOString(),
          });
          
        if (error) throw error;
        
        toast({
          title: 'Cliente cadastrado',
          description: 'O cliente foi cadastrado com sucesso.',
        });
      }
      
      // Navigate back to clients list
      navigate('/clientes');
    } catch (error) {
      console.error('Erro ao salvar cliente:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar os dados do cliente.',
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
          onClick={() => navigate('/clientes')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">
          {isEditMode ? 'Editar Cliente' : 'Novo Cliente'}
        </h1>
        <p className="text-muted-foreground mt-2">
          {isEditMode
            ? 'Edite as informações do cliente.'
            : 'Preencha os dados para cadastrar um novo cliente.'}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informações do Cliente</CardTitle>
          <CardDescription>
            Preencha os dados do cliente. Campos marcados com * são obrigatórios.
          </CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
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
                name="cpf_cnpj"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CPF / CNPJ *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="000.000.000-00 ou 00.000.000/0000-00" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="contato"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contato (opcional)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="E-mail ou telefone para contato" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/clientes')}
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
