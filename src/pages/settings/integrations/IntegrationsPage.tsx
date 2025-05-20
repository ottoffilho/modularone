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

// Esta é a interface principal para as credenciais que virão da Edge Function
interface CredencialServicoUsuario {
  id: string; // UUID da credencial
  fabricante_id: string; // UUID do fabricante
  fabricante_nome: string; // Nome do fabricante (do join na EF)
  // nome_referencia: string; // Se a EF retornar um nome customizável para a credencial
  credenciais_campos: Record<string, string>; // Os campos de credenciais em si (para edição, podem ser mascarados ou não enviados na listagem)
  status_validacao?: 'VALIDO' | 'INVALIDO' | 'PENDENTE' | 'EM_ANDAMENTO'; // Status da validação
  ultima_validacao_em?: string; // Timestamp da última validação
  // Adicionar quaisquer outros campos que a EF retorna para a listagem
}

// Interface para os valores recebidos do form
interface IntegrationFormValues {
  fabricante_id: string;
  credenciais: Record<string, string>;
}

const IntegrationsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user, session } = useAuth();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedCredential, setSelectedCredential] = useState<CredencialServicoUsuario | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [credentialToDeleteId, setCredentialToDeleteId] = useState<string | null>(null);
  
  const [credentialsList, setCredentialsList] = useState<CredencialServicoUsuario[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Função para buscar integrações/credenciais da Edge Function
  async function fetchIntegrations() {
    if (!session?.access_token) {
      // toast.info("Sessão não encontrada", { description: "Faça login para ver suas integrações." });
      setCredentialsList([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke<CredencialServicoUsuario[]>('manage-user-integration-credentials', {
        method: 'GET',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;
      
      // O 'data' da EF deve ser um array de CredencialServicoUsuario
      // incluindo fabricante_nome e outros campos relevantes para a lista.
      setCredentialsList(data || []);
    } catch (error: any) {
      console.error("Erro ao buscar integrações:", error);
      toast.error("Erro ao Buscar Integrações", {
        description: error.message || "Não foi possível carregar os dados.",
      });
      setCredentialsList([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (user && session) { // Garante que user e session existem antes de buscar
      fetchIntegrations();
    }
  }, [user, session]); // Adicionar session como dependência

  // Handler para abrir o diálogo de formulário (novo ou edição)
  const handleOpenFormDialog = (credential?: CredencialServicoUsuario) => {
    setSelectedCredential(credential || null);
    setIsFormOpen(true);
  };

  const handleCloseFormDialog = () => {
    setIsFormOpen(false);
    setSelectedCredential(null);
  };
  
  // Handler para confirmar e chamar a exclusão via Edge Function
  const handleDeleteIntegration = async () => {
    if (!credentialToDeleteId || !session?.access_token) {
      toast.error("Erro", { description: "Não foi possível identificar a credencial para exclusão ou sessão inválida." });
      setDeleteDialogOpen(false);
      return;
    }
    
    try {
      // A EF 'manage-user-integration-credentials' espera um body: { id: integrationId } para DELETE, ou apenas o ID no path
      // A EF atualizada espera o ID no path, então vamos ajustar a chamada.
      // Contudo, a biblioteca supabase.functions.invoke com method DELETE geralmente envia o body.
      // Vamos manter o body por enquanto, pois a EF parseia o ID do path E pode usar o body se o path parsing falhar.
      // Se a EF for estritamente path-based para DELETE ID, a chamada seria diferente.
      const { error: functionError } = await supabase.functions.invoke(`manage-user-integration-credentials/${credentialToDeleteId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
        // body: { id: credentialToDeleteId }, // O ID agora está no path, body não é mais necessário para DELETE por ID.
      });

      if (functionError) throw functionError;

      toast.success("Sucesso", { description: "Integração removida." });
      fetchIntegrations(); // Recarregar a lista
    } catch (error: any) {
      console.error("Erro ao excluir integração:", error);
      toast.error("Erro ao Excluir", {
        description: error.message || "Não foi possível remover a integração.",
      });
    } finally {
      setDeleteDialogOpen(false);
      setCredentialToDeleteId(null);
    }
  };

  // Handler para abrir o diálogo de confirmação de exclusão
  const openDeleteConfirmDialog = (credentialId: string) => {
    setCredentialToDeleteId(credentialId);
    setDeleteDialogOpen(true);
  };

  // Render Status (pode precisar de ajustes com base nos valores reais de status da EF)
  const renderStatus = (status?: 'VALIDO' | 'INVALIDO' | 'PENDENTE' | 'EM_ANDAMENTO') => {
    switch (status) {
      case 'VALIDO':
        return <span className="flex items-center text-green-600"><CheckCircle className="mr-1 h-4 w-4" /> Válido</span>;
      case 'INVALIDO':
        return <span className="flex items-center text-red-600"><XCircle className="mr-1 h-4 w-4" /> Inválido</span>;
      case 'PENDENTE':
        return <span className="flex items-center text-yellow-600"><AlertCircle className="mr-1 h-4 w-4" /> Pendente</span>;
      case 'EM_ANDAMENTO':
        return <span className="flex items-center text-blue-600"><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Em Validação</span>;
      default:
        return <span className="flex items-center text-gray-500"><AlertCircle className="mr-1 h-4 w-4" /> Desconhecido</span>;
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (e) {
      return 'Data inválida';
    }
  };

  if (isLoading && credentialsList.length === 0) { // Melhor condição de loading inicial
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-lg">Carregando integrações...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-2xl font-bold">Integrações de Serviços</CardTitle>
            <CardDescription>
              Gerencie suas credenciais de API para serviços externos como Growatt, SAJ, etc.
            </CardDescription>
          </div>
          <Button onClick={() => handleOpenFormDialog()} className="flex items-center">
            <PlusCircle className="mr-2 h-5 w-5" /> Adicionar Nova
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading && credentialsList.length > 0 && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Atualizando...
            </div>
          )}
          {!isLoading && credentialsList.length === 0 ? (
            <div className="text-center py-10">
              <PlugZap className="mx-auto h-16 w-16 text-gray-400 mb-4" />
              <p className="text-xl font-semibold text-gray-700">Nenhuma integração encontrada.</p>
              <p className="text-gray-500 mt-1">Comece adicionando uma nova integração de serviço.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fabricante</TableHead>
                  {/* <TableHead>Nome de Referência</TableHead> */}
                  <TableHead>Status</TableHead>
                  <TableHead>Última Validação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {credentialsList.map((cred) => (
                  <TableRow key={cred.id}>
                    <TableCell className="font-medium">{cred.fabricante_nome}</TableCell>
                    {/* <TableCell>{cred.nome_referencia || 'N/A'}</TableCell> */}
                    <TableCell>{renderStatus(cred.status_validacao)}</TableCell>
                    <TableCell>{formatDate(cred.ultima_validacao_em)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Abrir menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleOpenFormDialog(cred)}>
                            <Edit className="mr-2 h-4 w-4" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            // onClick={() => revalidateCredentialMutation.mutate(cred.id)}
                            // disabled={revalidateCredentialMutation.isPending}
                            // Ação de revalidar pode ser adicionada aqui se a EF suportar
                            onClick={() => toast.info('Revalidação de credenciais ainda não implementada.')}
                          >
                            <RefreshCw className="mr-2 h-4 w-4" /> Revalidar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openDeleteConfirmDialog(cred.id)} className="text-red-600 hover:!text-red-700">
                            <Trash2 className="mr-2 h-4 w-4" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {isFormOpen && (
        <CredentialFormDialog
          isOpen={isFormOpen}
          setIsOpen={setIsFormOpen} // Passar setIsFormOpen para fechar o dialog
          existingCredential={selectedCredential}
          onSaveSuccess={() => {
            handleCloseFormDialog(); // Fechar o dialogo
            fetchIntegrations();     // Recarregar a lista
          }}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta integração? Esta ação não pode ser desfeita e removerá permanentemente as credenciais associadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCredentialToDeleteId(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteIntegration} className="bg-red-600 hover:bg-red-700">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default IntegrationsPage; 