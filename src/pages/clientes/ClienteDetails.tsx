
import { useState, useEffect } from 'react';
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
  cpf_cnpj: string;
  contato: string | null;
  created_at: string;
  updated_at: string | null;
}

interface UC {
  id: string;
  identificador: string;
  endereco: string;
  distribuidora: string;
  faturas_count: number;
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

        // Get cliente data
        const { data: clienteData, error: clienteError } = await supabase
          .from('clientes')
          .select('*')
          .eq('id', id)
          .eq('user_id', user.id)
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

        setCliente(clienteData);

        // Get UCs associated with the client
        const { data: ucsData, error: ucsError } = await supabase
          .from('unidades_consumidoras')
          .select(`
            id,
            identificador,
            endereco,
            distribuidora,
            faturas:faturas(count)
          `)
          .eq('cliente_id', id)
          .eq('user_id', user.id);

        if (ucsError) throw ucsError;

        // Process UCs data to include faturas count
        const processedUcs = ucsData.map((uc: any) => ({
          ...uc,
          faturas_count: uc.faturas?.length || 0,
        }));

        setUcs(processedUcs);
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
  }, [id, user]);

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
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: 'Cliente removido',
        description: `O cliente ${cliente.nome_razao_social} foi removido com sucesso.`,
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
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <Button
            variant="ghost"
            className="mb-2"
            onClick={() => navigate('/clientes')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para a lista
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">
            {cliente.nome_razao_social}
          </h1>
          <p className="text-muted-foreground mt-2">
            Detalhes do cliente e unidades consumidoras associadas.
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to={`/clientes/${id}/editar`}>
              <Edit className="mr-2 h-4 w-4" /> Editar
            </Link>
          </Button>
          <Button 
            variant="destructive" 
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Excluir
          </Button>
        </div>
      </div>

      {/* Cliente Details */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhes do Cliente</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Nome / Razão Social</dt>
              <dd className="mt-1">{cliente.nome_razao_social}</dd>
            </div>
            
            <div>
              <dt className="text-sm font-medium text-muted-foreground">CPF / CNPJ</dt>
              <dd className="mt-1">{cliente.cpf_cnpj}</dd>
            </div>
            
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Contato</dt>
              <dd className="mt-1">{cliente.contato || '-'}</dd>
            </div>
            
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Data de Cadastro</dt>
              <dd className="mt-1">{new Date(cliente.created_at).toLocaleDateString()}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Unidades Consumidoras */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold tracking-tight">Unidades Consumidoras</h2>
          <Button asChild>
            <Link to={`/ucs/novo?cliente=${id}`}>
              <Plus className="mr-2 h-4 w-4" /> Nova UC
            </Link>
          </Button>
        </div>

        {ucs.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Nenhuma unidade consumidora cadastrada</CardTitle>
              <CardDescription>
                Este cliente ainda não possui unidades consumidoras cadastradas.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link to={`/ucs/novo?cliente=${id}`}>
                  <Plus className="mr-2 h-4 w-4" /> Cadastrar UC
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Identificador</TableHead>
                  <TableHead>Endereço</TableHead>
                  <TableHead>Distribuidora</TableHead>
                  <TableHead>Faturas</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ucs.map((uc) => (
                  <TableRow key={uc.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-primary" />
                        {uc.identificador}
                      </div>
                    </TableCell>
                    <TableCell>{uc.endereco}</TableCell>
                    <TableCell>{uc.distribuidora}</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <CalendarClock className="h-4 w-4 text-muted-foreground mr-2" />
                        {uc.faturas_count}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/ucs/${uc.id}`}>
                          Detalhes
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
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
