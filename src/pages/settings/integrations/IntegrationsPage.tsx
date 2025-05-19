import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  PlusCircle, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  RefreshCw, 
  Loader2, 
  PlugZap, 
  CheckCircle, 
  XCircle, 
  AlertCircle 
} from 'lucide-react';
import { CredentialFormDialog } from './CredentialFormDialog';

// Interfaces
interface Fabricante {
  id: string;
  nome: string;
  api_config_schema: unknown;
}

interface Credencial {
  id: string;
  fabricante_id: string;
  fabricante_nome: string;
  nome_referencia: string;
  status_validacao: string;
  ultima_validacao_em: string;
}

// Mocked interfaces (conforme sugerido, até termos os tipos reais do database.types.ts)
interface MockedIntegration {
  id: string;
  fabricanteNome: string;
  statusValidacao: 'Válido' | 'Inválido' | 'Pendente';
  ultimaValidacaoEm: string | null;
}

interface MockedFabricante {
  id: string;
  nome: string;
  api_config_schema: any; // Detalhar isso mais tarde
}

// Interface para os valores recebidos do form
interface IntegrationFormValues {
  fabricante_id: string;
  credenciais: Record<string, string>;
}

// Adapter para transformar os dados do form para o formato esperado pelo componente
function adaptFormValuesToIntegration(formValues: IntegrationFormValues, fabricantes: MockedFabricante[]): MockedIntegration {
  const fabricante = fabricantes.find(f => f.id === formValues.fabricante_id);
  
  return {
    id: formValues.fabricante_id, // Usando fabricante_id como id da integração
    fabricanteNome: fabricante?.nome || 'Desconhecido',
    statusValidacao: 'Pendente', // Status inicial
    ultimaValidacaoEm: new Date().toLocaleDateString()
  };
}

// Interface para o CredentialFormDialog (placeholder)
interface CredentialFormDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  initialData?: MockedIntegration | null;
  onSave: (data: IntegrationFormValues) => void;
}

const IntegrationsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCredential, setSelectedCredential] = useState<Credencial | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [credentialToDelete, setCredentialToDelete] = useState<string | null>(null);
  const [integrations, setIntegrations] = useState<MockedIntegration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<MockedIntegration | null>(null);

  // Consulta para buscar as credenciais do usuário
  const { data: credenciais, isLoading: isCredenciaisLoading, isError, error } = useQuery({
    queryKey: ['credenciais', user?.id],
    queryFn: async (): Promise<Credencial[]> => {
      if (!user) return [];

      // Buscar credenciais do usuário
      const { data: userCredentials, error } = await supabase
        .from('credenciais_servico_usuario')
        .select(`
          id,
          fabricante_id,
          nome_referencia,
          status_validacao,
          ultima_validacao_em
        `)
        .eq('user_id', user.id);

      if (error) throw error;

      // Buscar nomes dos fabricantes para cada credencial
      const enrichedCredentials = await Promise.all(
        userCredentials.map(async (cred) => {
          const { data: fabricante } = await supabase
            .from('fabricantes_equipamentos')
            .select('nome')
            .eq('id', cred.fabricante_id)
            .single();

          return {
            ...cred,
            fabricante_nome: fabricante?.nome || 'Desconhecido'
          };
        })
      );

      return enrichedCredentials as Credencial[];
    },
    enabled: !!user,
  });

  // Mutation para excluir credencial
  const deleteCredentialMutation = useMutation({
    mutationFn: async (credentialId: string) => {
      const { error } = await supabase
        .from('credenciais_servico_usuario')
        .delete()
        .eq('id', credentialId)
        .eq('user_id', user?.id);

      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      toast.success('Credencial excluída com sucesso');
      queryClient.invalidateQueries({ queryKey: ['credenciais'] });
      setDeleteDialogOpen(false);
      setCredentialToDelete(null);
    },
    onError: (error: unknown) => {
      toast.error(`Erro ao excluir credencial: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      setDeleteDialogOpen(false);
    }
  });

  // Mutation para revalidar credenciais
  const revalidateCredentialMutation = useMutation({
    mutationFn: async (credentialId: string) => {
      // Em uma implementação real, você chamaria uma Edge Function para revalidar
      // Por enquanto, apenas simularemos uma atualização de status
      const { error } = await supabase
        .from('credenciais_servico_usuario')
        .update({
          status_validacao: 'VALIDO', // Simulando validação bem-sucedida
          ultima_validacao_em: new Date().toISOString()
        })
        .eq('id', credentialId)
        .eq('user_id', user?.id);

      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      toast.success('Credenciais revalidadas com sucesso');
      queryClient.invalidateQueries({ queryKey: ['credenciais'] });
    },
    onError: (error: unknown) => {
      toast.error(`Erro ao revalidar credenciais: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  });

  // Mocked data loading
  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      setIntegrations([
        { id: '1', fabricanteNome: 'Growatt', statusValidacao: 'Válido', ultimaValidacaoEm: new Date().toLocaleDateString() },
        { id: '2', fabricanteNome: 'SAJ', statusValidacao: 'Pendente', ultimaValidacaoEm: null },
        { id: '3', fabricanteNome: 'GoodWe', statusValidacao: 'Inválido', ultimaValidacaoEm: new Date(Date.now() - 86400000 * 5).toLocaleDateString() },
      ]);
      setIsLoading(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  // Handlers
  const handleOpenDialog = (credential?: Credencial) => {
    if (credential) {
      setSelectedCredential(credential);
    } else {
      setSelectedCredential(null);
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedCredential(null);
  };

  const handleDeleteClick = (credential: Credencial) => {
    setCredentialToDelete(credential.id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (credentialToDelete) {
      deleteCredentialMutation.mutate(credentialToDelete);
    }
  };

  const handleRevalidateClick = (credentialId: string) => {
    revalidateCredentialMutation.mutate(credentialId);
  };

  const handleAddNew = () => {
    setSelectedIntegration(null);
    setIsFormOpen(true);
  };

  const handleEdit = (integration: MockedIntegration) => {
    setSelectedIntegration(integration);
    setIsFormOpen(true);
  };

  const handleDeleteIntegration = (integrationId: string) => {
    // Lógica de exclusão será implementada depois
    console.log(`Excluir integração: ${integrationId}`);
    alert(`Simular exclusão da integração ID: ${integrationId}`);
    // setIntegrations(prev => prev.filter(int => int.id !== integrationId)); // Exemplo de como poderia ser
  };

  // Renderizar status com ícones
  const renderStatus = (status: string) => {
    if (status === 'VALIDO') {
      return (
        <div className="flex items-center gap-2 text-green-600">
          <CheckCircle className="w-4 h-4" />
          <span>Válido</span>
        </div>
      );
    } else if (status === 'INVALIDO') {
      return (
        <div className="flex items-center gap-2 text-red-600">
          <XCircle className="w-4 h-4" />
          <span>Inválido</span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center gap-2 text-amber-600">
          <AlertCircle className="w-4 h-4" />
          <span>Pendente</span>
        </div>
      );
    }
  };

  // Formatador de data
  const formatDate = (dateString: string) => {
    if (!dateString) return 'Nunca';
    
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Integrações</h1>
          <p className="text-muted-foreground mt-2">
            Gerencie suas integrações com fabricantes de equipamentos e serviços externos.
          </p>
        </div>
        <Button onClick={handleAddNew} className="w-full sm:w-auto">
          <PlusCircle className="h-4 w-4 mr-2" />
          Nova Integração
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-2xl">
            <PlugZap className="mr-2 h-5 w-5" />
            Credenciais de API
          </CardTitle>
          <CardDescription>
            Configure e gerencie suas credenciais para integração com APIs de fabricantes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : isError ? (
            <div className="p-8 text-center">
              <p className="text-red-500 mb-2">Erro ao carregar credenciais</p>
              <p className="text-sm text-muted-foreground">
                {(error as Error)?.message || 'Ocorreu um erro ao carregar suas credenciais de integração.'}
              </p>
            </div>
          ) : credenciais && credenciais.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fabricante</TableHead>
                    <TableHead>Nome de Referência</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Última Validação</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {credenciais.map((credencial) => (
                    <TableRow key={credencial.id}>
                      <TableCell className="font-medium">{credencial.fabricante_nome}</TableCell>
                      <TableCell>{credencial.nome_referencia}</TableCell>
                      <TableCell>{renderStatus(credencial.status_validacao)}</TableCell>
                      <TableCell>{formatDate(credencial.ultima_validacao_em)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Abrir menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenDialog(credencial)}>
                              <Edit className="mr-2 h-4 w-4" />
                              <span>Editar</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleRevalidateClick(credencial.id)}
                              disabled={revalidateCredentialMutation.isPending}
                            >
                              <RefreshCw className="mr-2 h-4 w-4" />
                              <span>Revalidar</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDeleteClick(credencial)}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              <span>Excluir</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="p-12 text-center border-2 border-dashed rounded-md">
              <PlugZap className="h-10 w-10 mx-auto mb-4 text-muted-foreground/60" />
              <h3 className="text-lg font-medium mb-1">Nenhuma integração configurada</h3>
              <p className="text-muted-foreground mb-4">
                Para começar a usar APIs de fabricantes, adicione suas credenciais de integração.
              </p>
              <Button onClick={handleAddNew}>
                <PlusCircle className="h-4 w-4 mr-2" />
                Adicionar Integração
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog para adicionar/editar credenciais */}
      <CredentialFormDialog
        isOpen={isFormOpen}
        setIsOpen={setIsFormOpen}
        initialData={selectedIntegration ? {
          fabricante_id: selectedIntegration.id,
          credenciais_seguras: {} // Não temos as credenciais para edição, só os metadados
        } : null}
        onSave={(formValues) => {
          console.log('Integração salva/atualizada (mock):', formValues);
          
          // Lista mockada de fabricantes para o adaptador
          const mockFabricantes: MockedFabricante[] = [
            { id: 'growatt_mock_id', nome: 'Growatt', api_config_schema: { fields: [] } },
            { id: 'saj_mock_id', nome: 'SAJ', api_config_schema: { fields: [] } },
            { id: 'goodwe_mock_id', nome: 'GoodWe', api_config_schema: { fields: [] } }
          ];
          
          setIsLoading(true);
          const timer = setTimeout(() => {
            setIntegrations(prevIntegrations => {
              // Verificar se a integração já existe pelo fabricante_id
              const existingIndex = prevIntegrations.findIndex(int => int.id === formValues.fabricante_id);
              
              if (existingIndex > -1) {
                // Atualiza o item existente
                const updatedIntegrations = [...prevIntegrations];
                const adaptedData = adaptFormValuesToIntegration(formValues, mockFabricantes);
                
                updatedIntegrations[existingIndex] = {
                  ...updatedIntegrations[existingIndex],
                  fabricanteNome: adaptedData.fabricanteNome,
                  statusValidacao: 'Válido', // Assumindo que edição implica em validação
                  ultimaValidacaoEm: new Date().toLocaleDateString()
                };
                return updatedIntegrations;
              } else {
                // Adiciona novo item
                const newIntegration = adaptFormValuesToIntegration(formValues, mockFabricantes);
                return [...prevIntegrations, newIntegration];
              }
            });
            setIsLoading(false);
          }, 500);
          return () => clearTimeout(timer);
        }}
      />

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta credencial de integração?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteCredentialMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={deleteCredentialMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteCredentialMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Excluindo...
                </>
              ) : (
                'Sim, excluir'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default IntegrationsPage; 