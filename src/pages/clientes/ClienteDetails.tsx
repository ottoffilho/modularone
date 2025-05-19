import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Plus,
  Zap,
  CalendarClock,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Cliente {
  id: string;
  nome_razao_social: string;
  email: string;
  telefone: string;
  tipo: 'PF' | 'PJ';
  dados_adicionais: {
    email?: string;
    telefone?: string;
    tipo?: 'PF' | 'PJ';
    cpf?: string;
    cnpj?: string;
    inscricao_estadual?: string;
  } | null;
  created_at: string;
  updated_at: string | null;
}

interface UC {
  id: string;
  nome_identificador: string | null;
  endereco_completo: string;
}

export default function ClienteDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [ucs, setUcs] = useState<UC[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    const loadClienteDetails = async () => {
      if (!id || !user) return;

      try {
        setLoading(true);

        const { data: clienteData, error: clienteError } = await supabase
          .from('clientes')
          .select('id, nome_razao_social, dados_adicionais, created_at, updated_at')
          .eq('id', id)
          .eq('proprietario_user_id', user.id)
          .single();

        if (clienteError) throw clienteError;
        
        if (!clienteData) {
          toast({
            title: 'Cliente não encontrado',
            description: 'O cliente que você está tentando visualizar não existe ou você não tem permissão para acessá-lo.',
            variant: 'destructive',
          });
          navigate('/clientes');
          return;
        }

        const emailFromDados = clienteData.dados_adicionais?.email || '';
        const telefoneFromDados = clienteData.dados_adicionais?.telefone || '';
        const tipoFromDados = clienteData.dados_adicionais?.tipo || 'PF';

        setCliente({
          id: clienteData.id,
          nome_razao_social: clienteData.nome_razao_social,
          email: emailFromDados,
          telefone: telefoneFromDados,
          tipo: tipoFromDados as 'PF' | 'PJ',
          dados_adicionais: clienteData.dados_adicionais,
          created_at: clienteData.created_at,
          updated_at: clienteData.updated_at,
        });

        // Get UCs associated with the client
        const { data: ucsData, error: ucsError } = await supabase
          .from('unidades_consumidoras')
          .select(`
            id,
            nome_identificador, 
            logradouro,
            numero_endereco,
            bairro,
            cidade,
            estado
          `)
          .eq('cliente_id', id)
          .eq('proprietario_user_id', user.id);

        if (ucsError) throw ucsError;

        // Definir tipo para uc
        type UCFromDB = {
          id: string;
          nome_identificador: string | null;
          logradouro?: string;
          numero_endereco?: string;
          bairro?: string;
          cidade?: string;
          estado?: string;
        };

        const processedUcs = (ucsData as UCFromDB[] | undefined)?.map((uc) => {
          const enderecoParts = [
            uc.logradouro,
            uc.numero_endereco,
            uc.bairro,
            uc.cidade,
            uc.estado,
          ].filter(Boolean);
          return {
            id: uc.id,
            nome_identificador: uc.nome_identificador,
            endereco_completo: enderecoParts.join(', ') || 'Endereço não informado',
          };
        }) || [];

        setUcs(processedUcs as UC[]);
      } catch (error) {
        console.error('Erro ao carregar detalhes do cliente:', error);
        toast({
          title: 'Erro',
          description: 'Não foi possível carregar os detalhes do cliente.',
          variant: 'destructive',
        });
        navigate('/clientes');
      } finally {
        setLoading(false);
      }
    };

    loadClienteDetails();
  }, [id, user, navigate, toast]);

  const handleDelete = async () => {
    if (!cliente || !user) return;

    try {
      setLoading(true);

      // Check if client has associated UCs
      if (ucs.length > 0) {
        toast({
          title: 'Não é possível excluir',
          description: 'Este cliente possui unidades consumidoras associadas. Remova as UCs primeiro.',
          variant: 'destructive',
        });
        setDeleteDialogOpen(false);
        return;
      }

      // Delete the client
      const { error } = await supabase
        .from('clientes')
        .delete()
        .eq('id', cliente.id)
        .eq('proprietario_user_id', user.id);

      if (error) throw error;

      toast({
        title: 'Cliente removido',
        description: 'O cliente ' + cliente.nome_razao_social + ' foi removido com sucesso.',
      });
      
      navigate('/clientes');
    } catch (error) {
      console.error('Erro ao excluir cliente:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir o cliente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setDeleteDialogOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!cliente) {
    return null;
  }

  return (
    <div className="space-y-6 p-2 md:p-6 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
        <div>
          <Button
            variant="outline"
            size="sm"
            className="mb-2 border-border/70 hover:bg-muted/50 transition-colors duration-150"
            onClick={() => navigate('/clientes')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Lista
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            {cliente.nome_razao_social}
          </h1>
          <p className="text-muted-foreground mt-1 md:mt-2 text-sm md:text-base">
            Detalhes do cliente e unidades consumidoras associadas.
          </p>
        </div>
        
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" asChild className="border-border/70 hover:bg-muted/50 transition-colors duration-150">
            <Link to={`/clientes/${id}/editar`}>
              <Edit className="mr-2 h-4 w-4" /> Editar Cliente
            </Link>
          </Button>
          <Button 
            variant="destructive" 
            onClick={() => setDeleteDialogOpen(true)}
            className="shadow-md hover:shadow-lg transition-all duration-150 ease-in-out transform hover:scale-105"
          >
            <Trash2 className="mr-2 h-4 w-4" /> Excluir Cliente
          </Button>
        </div>
      </div>

      {/* Cliente Details Card */}
      <Card className="shadow-2xl border border-primary/20 bg-card/80 backdrop-blur-lg rounded-xl overflow-hidden">
        <CardHeader className="border-b border-border/30 bg-muted/20 px-6 py-5">
          <CardTitle className="text-xl text-primary">Dados Cadastrais</CardTitle>
        </CardHeader>
        <CardContent className="px-6 py-8">
          <dl className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-8">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Nome / Razão Social</dt>
              <dd className="mt-1 text-foreground font-semibold text-lg">{cliente.nome_razao_social}</dd>
            </div>
            
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Tipo de Cliente</dt>
              <dd className="mt-1 text-foreground">
                <span className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full ${
                  cliente.tipo === 'PJ' ? 'bg-sky-100 text-sky-700 border border-sky-200 dark:bg-sky-900/50 dark:text-sky-300 dark:border-sky-700' : 'bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-700'
                }`}>
                  {cliente.tipo === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'}
                </span>
              </dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-muted-foreground">Email</dt>
              <dd className="mt-1 text-foreground hover:text-primary transition-colors"><a href={`mailto:${cliente.email}`}>{cliente.email}</a></dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-muted-foreground">Telefone</dt>
              <dd className="mt-1 text-foreground">{cliente.telefone || '-'}</dd>
            </div>
            
            {cliente.tipo === 'PF' && cliente.dados_adicionais?.cpf && (
              <div>
                <dt className="text-sm font-medium text-muted-foreground">CPF</dt>
                <dd className="mt-1 text-foreground">{cliente.dados_adicionais.cpf}</dd>
              </div>
            )}
            
            {cliente.tipo === 'PJ' && cliente.dados_adicionais?.cnpj && (
              <div>
                <dt className="text-sm font-medium text-muted-foreground">CNPJ</dt>
                <dd className="mt-1 text-foreground">{cliente.dados_adicionais.cnpj}</dd>
              </div>
            )}

            {cliente.tipo === 'PJ' && cliente.dados_adicionais?.inscricao_estadual && (
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Inscrição Estadual</dt>
                <dd className="mt-1 text-foreground">{cliente.dados_adicionais.inscricao_estadual}</dd>
              </div>
            )}
            
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Data de Cadastro</dt>
              <dd className="mt-1">{new Date(cliente.created_at).toLocaleDateString()}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Unidades Consumidoras Card */}
      {ucs.length > 0 && (
        <Card className="shadow-2xl border border-border/30 bg-card/80 backdrop-blur-lg rounded-xl overflow-hidden mt-8">
          <CardHeader className="border-b border-border/30 bg-muted/20 px-6 py-5">
            <div className="flex justify-between items-center">
              <CardTitle className="text-xl text-primary">Unidades Consumidoras ({ucs.length})</CardTitle>
              <Button variant="outline" size="sm" onClick={() => navigate(`/ucs/novo?clienteId=${cliente?.id}`)} className="border-primary/50 text-primary hover:bg-primary/10 hover:text-primary">
                <Plus className="mr-2 h-4 w-4" /> Adicionar UC
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="min-w-full">
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Nome da UC</TableHead>
                    <TableHead className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Endereço</TableHead>
                    <TableHead className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-border/20">
                  {ucs.map((uc) => (
                    <TableRow key={uc.id} className="hover:bg-muted/20 transition-colors">
                      <TableCell className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">{uc.nome_identificador || 'Não informado'}</TableCell>
                      <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{uc.endereco_completo}</TableCell>
                      <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-right">
                        <Button variant="ghost" size="sm" onClick={() => navigate(`/ucs/${uc.id}`)} className="text-primary hover:text-primary/80">
                          Ver Detalhes
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal de Confirmação de Deleção */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="border-primary/20 shadow-2xl bg-card/90 backdrop-blur-md rounded-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-destructive">Confirmar Exclusão do Cliente</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o cliente{' '}
              <span className="font-medium">
                {cliente.nome_razao_social}
              </span>
              ? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive"
              onClick={handleDelete}
              disabled={loading}
            >
              {loading ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
