import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Search, Zap, Trash2, Edit, EyeIcon } from 'lucide-react';
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

// Interface ajustada para corresponder ao retorno da função RPC
interface UC {
  id: string;
  nome_identificador: string | null;
  numero_uc: string | null;
  endereco: string | null;
  cliente_id: string | null;
  created_at: string;
  cliente_nome_razao_social: string | null;
  distribuidora_nome: string | null;
  faturas_count: number;
}

export default function UCsList() {
  const [ucs, setUcs] = useState<UC[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [ucToDelete, setUcToDelete] = useState<UC | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const loadUCs = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Chamar a função RPC
      const { data, error } = await supabase.rpc('get_unidades_consumidoras_com_contagem_faturas', {
        p_user_id: user.id,
      });

      if (error) throw error;

      // Os dados já vêm processados da função RPC
      // A contagem de faturas (BIGINT no PG) será um number ou string no JS, converter se necessário.
      const processedData = data.map((item: UC) => ({
        ...item,
        faturas_count: Number(item.faturas_count),
      }));
      setUcs(processedData || []);

    } catch (error) {
      console.error('Erro ao carregar unidades consumidoras:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar a lista de unidades consumidoras.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    loadUCs();
  }, [user, loadUCs]);

  const handleDelete = async (uc: UC) => {
    if (!uc || !uc.id) return;

    try {
      setLoading(true);
      
      // Check if UC has associated faturas (usa o faturas_count que já temos)
      if (uc.faturas_count > 0) {
        throw new Error('Esta unidade consumidora possui faturas associadas. Remova as faturas primeiro.');
      }
      
      // Delete the UC
      const { error } = await supabase
        .from('unidades_consumidoras')
        .delete()
        .eq('id', uc.id)
        .eq('proprietario_user_id', user?.id); // Manter a verificação de user_id para segurança na deleção

      if (error) throw error;

      // Reload UCs list and show success message
      toast({
        title: 'Unidade Consumidora removida',
        description: `A UC ${uc.nome_identificador || uc.numero_uc} foi removida com sucesso.`,
      });
      
      setUcToDelete(null);
      loadUCs(); // Recarregar dados após a exclusão
    } catch (error) {
      console.error('Erro ao excluir unidade consumidora:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Não foi possível excluir a unidade consumidora.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Filter UCs by search query
  const filteredUCs = ucs.filter((uc) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      (uc.nome_identificador && uc.nome_identificador.toLowerCase().includes(searchLower)) ||
      (uc.numero_uc && uc.numero_uc.toLowerCase().includes(searchLower)) ||
      (uc.endereco && uc.endereco.toLowerCase().includes(searchLower)) ||
      (uc.distribuidora_nome && uc.distribuidora_nome.toLowerCase().includes(searchLower)) ||
      (uc.cliente_nome_razao_social && uc.cliente_nome_razao_social.toLowerCase().includes(searchLower))
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Unidades Consumidoras</h1>
          <p className="text-muted-foreground mt-2">
            Gerencie suas unidades consumidoras e as faturas associadas.
          </p>
        </div>
        <Button asChild>
          <Link to="/ucs/novo">
            <PlusCircle className="mr-2 h-4 w-4" /> Nova UC
          </Link>
        </Button>
      </div>

      <div className="flex items-center w-full max-w-sm relative">
        <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar unidades consumidoras..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Spinner size="lg" />
        </div>
      ) : filteredUCs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 border rounded-lg bg-background">
          <Zap className="h-12 w-12 text-muted-foreground mb-4" />
          {searchQuery ? (
            <>
              <h3 className="text-lg font-medium">Nenhuma unidade consumidora encontrada</h3>
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
              <h3 className="text-lg font-medium">Nenhuma unidade consumidora cadastrada</h3>
              <p className="text-muted-foreground mt-1">
                Comece cadastrando sua primeira unidade consumidora.
              </p>
              <Button asChild className="mt-4">
                <Link to="/ucs/novo">
                  <PlusCircle className="mr-2 h-4 w-4" /> Nova UC
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
                <TableHead>Identificador</TableHead>
                <TableHead>Número UC</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Endereço</TableHead>
                <TableHead>Distribuidora</TableHead>
                <TableHead>Faturas</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUCs.map((uc) => (
                <TableRow key={uc.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-primary" />
                      {uc.nome_identificador || '-'}
                    </div>
                  </TableCell>
                  <TableCell>{uc.numero_uc || '-'}</TableCell>
                  <TableCell>{uc.cliente_nome_razao_social || '-'}</TableCell>
                  <TableCell>{uc.endereco || '-'}</TableCell>
                  <TableCell>{uc.distribuidora_nome || '-'}</TableCell>
                  <TableCell>{uc.faturas_count}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" asChild>
                        <Link to={`/ucs/${uc.id}`}>
                          <EyeIcon className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button variant="ghost" size="icon" asChild>
                        <Link to={`/ucs/${uc.id}/editar`}>
                          <Edit className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => setUcToDelete(uc)}
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
      <Dialog open={!!ucToDelete} onOpenChange={() => setUcToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir a unidade consumidora{' '}
              <span className="font-medium">
                {ucToDelete?.nome_identificador || ucToDelete?.numero_uc}
              </span>
              ? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUcToDelete(null)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive"
              onClick={() => ucToDelete && handleDelete(ucToDelete)}
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
