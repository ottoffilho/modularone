
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Search, Users, Trash2, Edit, EyeIcon } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Cliente {
  id: string;
  nome_razao_social: string;
  cpf_cnpj: string;
  contato: string | null;
  created_at: string;
  uc_count: number;
}

export default function ClientesList() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [clienteToDelete, setClienteToDelete] = useState<Cliente | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const loadClientes = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Join with unidades_consumidoras to get UC count
      const { data, error } = await supabase
        .from('clientes')
        .select(`
          *,
          unidades_consumidoras:unidades_consumidoras(id)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Process data to include UC count
      const processedData = data.map((cliente: any) => ({
        ...cliente,
        uc_count: cliente.unidades_consumidoras ? cliente.unidades_consumidoras.length : 0,
      }));

      setClientes(processedData);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar a lista de clientes.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClientes();
  }, [user]);

  const handleDelete = async (cliente: Cliente) => {
    if (!cliente || !cliente.id) return;

    try {
      setLoading(true);
      
      // Check if client has associated UCs
      if (cliente.uc_count > 0) {
        throw new Error('Este cliente possui unidades consumidoras associadas. Remova as UCs primeiro.');
      }
      
      // Delete the client
      const { error } = await supabase
        .from('clientes')
        .delete()
        .eq('id', cliente.id)
        .eq('user_id', user?.id);

      if (error) throw error;

      // Reload clients list and show success message
      toast({
        title: 'Cliente removido',
        description: `O cliente ${cliente.nome_razao_social} foi removido com sucesso.`,
      });
      
      setClienteToDelete(null);
      loadClientes();
    } catch (error) {
      console.error('Erro ao excluir cliente:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Não foi possível excluir o cliente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Filter clients by search query
  const filteredClientes = clientes.filter((cliente) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      cliente.nome_razao_social.toLowerCase().includes(searchLower) ||
      cliente.cpf_cnpj.includes(searchQuery) ||
      (cliente.contato && cliente.contato.toLowerCase().includes(searchLower))
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground mt-2">
            Gerencie seus clientes e suas respectivas unidades consumidoras.
          </p>
        </div>
        <Button asChild>
          <Link to="/clientes/novo">
            <PlusCircle className="mr-2 h-4 w-4" /> Novo Cliente
          </Link>
        </Button>
      </div>

      <div className="flex items-center w-full max-w-sm relative">
        <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar clientes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Spinner size="lg" />
        </div>
      ) : filteredClientes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 border rounded-lg bg-background">
          <Users className="h-12 w-12 text-muted-foreground mb-4" />
          {searchQuery ? (
            <>
              <h3 className="text-lg font-medium">Nenhum cliente encontrado</h3>
              <p className="text-muted-foreground mt-1">
                Nenhum resultado para "{searchQuery}". Tente uma busca diferente.
              </p>
              <Button 
                variant="link" 
                onClick={() => setSearchQuery('')} 
                className="mt-4"
              >
                Limpar busca
              </Button>
            </>
          ) : (
            <>
              <h3 className="text-lg font-medium">Nenhum cliente cadastrado</h3>
              <p className="text-muted-foreground mt-1">
                Comece cadastrando seu primeiro cliente.
              </p>
              <Button asChild className="mt-4">
                <Link to="/clientes/novo">
                  <PlusCircle className="mr-2 h-4 w-4" /> Novo Cliente
                </Link>
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome / Razão Social</TableHead>
                <TableHead>CPF / CNPJ</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>UCs</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClientes.map((cliente) => (
                <TableRow key={cliente.id}>
                  <TableCell className="font-medium">{cliente.nome_razao_social}</TableCell>
                  <TableCell>{cliente.cpf_cnpj}</TableCell>
                  <TableCell>{cliente.contato || '-'}</TableCell>
                  <TableCell>{cliente.uc_count}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" asChild>
                        <Link to={`/clientes/${cliente.id}`}>
                          <EyeIcon className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button variant="ghost" size="icon" asChild>
                        <Link to={`/clientes/${cliente.id}/editar`}>
                          <Edit className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => setClienteToDelete(cliente)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={!!clienteToDelete} onOpenChange={() => setClienteToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o cliente{' '}
              <span className="font-medium">
                {clienteToDelete?.nome_razao_social}
              </span>
              ? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClienteToDelete(null)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive"
              onClick={() => clienteToDelete && handleDelete(clienteToDelete)}
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
