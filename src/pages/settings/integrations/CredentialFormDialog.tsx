import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Key } from 'lucide-react';

// Interfaces
interface CredentialFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  credential?: {
    id: string;
    fabricante_id: string;
    nome_referencia: string;
  } | null;
  onSuccess?: () => void;
}

interface Fabricante {
  id: string;
  nome: string;
  api_config_schema: any;
}

interface ApiConfigField {
  name: string;
  label: string;
  type: string;
  required: boolean;
}

const getBaseSchema = () => {
  return z.object({
    fabricante_id: z.string().uuid('Selecione um fabricante'),
    nome_referencia: z.string().optional(),
  });
};

const CredentialFormDialog: React.FC<CredentialFormProps> = ({ 
  open, 
  onOpenChange, 
  credential, 
  onSuccess 
}) => {
  const { user } = useAuth();
  const [fabricantes, setFabricantes] = useState<Fabricante[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingFabricantes, setFetchingFabricantes] = useState(true);
  const [selectedFabricante, setSelectedFabricante] = useState<Fabricante | null>(null);
  
  // Schema inicial básico
  const [validationSchema, setValidationSchema] = useState(getBaseSchema());
  
  // Obter fabricantes no carregamento
  useEffect(() => {
    const fetchFabricantes = async () => {
      try {
        setFetchingFabricantes(true);
        
        const { data, error } = await supabase
          .from('fabricantes_equipamentos')
          .select('id, nome, api_config_schema')
          .eq('suporta_api_dados', true);
          
        if (error) throw error;
        
        setFabricantes(data || []);
      } catch (error) {
        console.error('Erro ao buscar fabricantes:', error);
        toast.error('Erro ao carregar fabricantes disponíveis');
      } finally {
        setFetchingFabricantes(false);
      }
    };
    
    if (open) {
      fetchFabricantes();
    }
  }, [open]);
  
  // Formulário com validação
  const form = useForm<z.infer<typeof validationSchema>>({
    resolver: zodResolver(validationSchema),
    defaultValues: {
      fabricante_id: credential?.fabricante_id || '',
      nome_referencia: credential?.nome_referencia || '',
    },
  });

  // Atualizar schema quando o fabricante mudar
  useEffect(() => {
    if (!selectedFabricante || !selectedFabricante.api_config_schema?.fields) return;
    
    // Construir schema dinâmico com base nos campos do fabricante
    let dynamicSchema = getBaseSchema();
    
    // Objeto para armazenar configurações de credenciais
    let credenciaisConfig: Record<string, z.ZodTypeAny> = {};
    
    // Para cada campo no schema do fabricante
    for (const field of selectedFabricante.api_config_schema.fields) {
      let fieldValidation;
      
      if (field.type === 'text' || field.type === 'password') {
        if (field.required) {
          fieldValidation = z.string().min(1, `${field.label} é obrigatório`);
        } else {
          fieldValidation = z.string().optional();
        }
      } else {
        // Outros tipos de campo, se necessário
        fieldValidation = z.string().optional();
      }
      
      credenciaisConfig[field.name] = fieldValidation;
    }
    
    // Adicionar validações de campos de credenciais ao schema base
    const newSchema = dynamicSchema.extend(credenciaisConfig);
    setValidationSchema(newSchema);
    
    // Reset form com schema atualizado
    form.reset(form.getValues());
  }, [selectedFabricante]);
  
  // Buscar dados da credencial para edição
  useEffect(() => {
    const fetchCredentialDetails = async () => {
      if (!credential || !user) return;
      
      try {
        // Obter detalhes do fabricante selecionado
        const fabricante = fabricantes.find(f => f.id === credential.fabricante_id);
        if (fabricante) {
          setSelectedFabricante(fabricante);
        }
        
        // Não precisamos buscar as credenciais seguras aqui - serão preenchidas pelo usuário novamente
        // Os campos sensíveis nunca são exibidos em texto claro no front-end
      } catch (error) {
        console.error('Erro ao buscar detalhes da credencial:', error);
        toast.error('Erro ao carregar detalhes da credencial');
      }
    };
    
    if (open && credential && fabricantes.length > 0) {
      fetchCredentialDetails();
    }
  }, [credential, open, fabricantes, user]);
  
  // Handler de mudança de fabricante
  const handleFabricanteChange = (fabricanteId: string) => {
    const fabricante = fabricantes.find(f => f.id === fabricanteId);
    if (fabricante) {
      setSelectedFabricante(fabricante);
      
      // Atualizar nome de referência se vazio
      const currentNomeRef = form.getValues('nome_referencia');
      if (!currentNomeRef) {
        form.setValue('nome_referencia', `${fabricante.nome} API`);
      }
    } else {
      setSelectedFabricante(null);
    }
  };
  
  // Submissão do formulário
  const onSubmit = async (values: z.infer<typeof validationSchema>) => {
    if (!user || !selectedFabricante) return;
    
    try {
      setLoading(true);
      
      // Extrair campos específicos para o objeto de credenciais
      const credenciaisObjeto: Record<string, string> = {};
      
      // Iterar sobre campos do schema
      if (selectedFabricante.api_config_schema?.fields) {
        for (const field of selectedFabricante.api_config_schema.fields) {
          const fieldName = field.name;
          // @ts-ignore - Campos dinâmicos
          const fieldValue = values[fieldName];
          
          if (fieldValue) {
            credenciaisObjeto[fieldName] = fieldValue;
          }
        }
      }
      
      // Preparar payload para a Edge Function
      const payload = {
        fabricante_id: values.fabricante_id,
        nome_referencia: values.nome_referencia,
        credenciais_objeto: credenciaisObjeto
      };
      
      // Chamar a Edge Function para processar e salvar as credenciais
      const { data, error } = await supabase.functions.invoke('manage-user-integration-credentials', {
        body: payload
      });
      
      if (error) throw error;
      
      toast.success(credential 
        ? 'Credenciais atualizadas com sucesso' 
        : 'Credenciais registradas com sucesso'
      );
      
      // Callback de sucesso
      if (onSuccess) {
        onSuccess();
      }
      
      // Fechar o diálogo
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao salvar credenciais:', error);
      toast.error(`Erro ao ${credential ? 'atualizar' : 'registrar'} credenciais: ${
        (error as any)?.message || 'Erro desconhecido'
      }`);
    } finally {
      setLoading(false);
    }
  };

  // Renderizar campos dinâmicos com base no schema do fabricante
  const renderDynamicFields = () => {
    if (!selectedFabricante || !selectedFabricante.api_config_schema?.fields) {
      return null;
    }
    
    return selectedFabricante.api_config_schema.fields.map((field: ApiConfigField) => {
      return (
        <FormField
          key={field.name}
          // @ts-ignore - Campos dinâmicos
          control={form.control}
          name={field.name}
          render={({ field: formField }) => (
            <FormItem>
              <FormLabel>{field.label}{field.required && ' *'}</FormLabel>
              <FormControl>
                <Input 
                  {...formField} 
                  type={field.type} 
                  placeholder={`Digite ${field.label.toLowerCase()}`}
                  autoComplete={field.type === 'password' ? 'new-password' : 'off'}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      );
    });
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{credential ? 'Editar' : 'Adicionar'} Credenciais de API</DialogTitle>
          <DialogDescription>
            {credential 
              ? 'Atualize suas credenciais para esta integração de API.' 
              : 'Configure suas credenciais para acessar APIs de fabricantes.'
            }
          </DialogDescription>
        </DialogHeader>
        
        {fetchingFabricantes ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="fabricante_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fabricante *</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        field.onChange(value);
                        handleFabricanteChange(value);
                      }}
                      value={field.value}
                      disabled={!!credential} // Não permite mudar o fabricante na edição
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um fabricante" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {fabricantes.map((fabricante) => (
                          <SelectItem key={fabricante.id} value={fabricante.id}>
                            {fabricante.nome}
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
                name="nome_referencia"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome de Referência</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Ex: Growatt API Principal"
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {selectedFabricante && (
                <div className="border-t pt-4 mt-4">
                  <div className="flex items-center mb-4">
                    <Key className="h-4 w-4 mr-2 text-amber-500" />
                    <h4 className="font-medium">Credenciais de Acesso</h4>
                  </div>
                  <div className="space-y-4">
                    {renderDynamicFields()}
                  </div>
                </div>
              )}
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => onOpenChange(false)}
                  disabled={loading}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading || !selectedFabricante}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {credential ? 'Atualizando...' : 'Salvando...'}
                    </>
                  ) : (
                    credential ? 'Atualizar Credenciais' : 'Salvar Credenciais'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CredentialFormDialog; 