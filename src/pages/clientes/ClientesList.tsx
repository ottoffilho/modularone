import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient, type QueryFunctionContext } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from 'sonner'; // Para notificações
import { AppShell } from '@/components/layout/AppShell'; // Assumindo que AppShell está aqui
import { PlusCircle, Search, MoreHorizontal, Pencil, Eye, Plug, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase'; // Importar supabase client

// Tipagem para os dados do cliente
interface Cliente {
  id: string;
  nome: string; // Nome ou Razão Social
  email: string;
  telefone: string;
  tipo: 'PF' | 'PJ';
  ucsCount: number; // Contagem de UCs
}

// Tipagem para os dados que vêm do banco
interface ClienteFromDB {
  id: string;
  nome_razao_social: string;
  dados_adicionais?: {
    email?: string;
    telefone?: string;
    tipo?: 'PF' | 'PJ';
  } | null;
  unidades_consumidoras?: { count: number }[] | { count: number };
}

// Definindo o tipo da QueryKey para fetchClientesAPI
// [identificador_da_query, termo_de_busca, filtro_tipo_cliente]
type ClientesQueryKey = [string, string, string | undefined];

// Função de API que busca os clientes do Supabase
const fetchClientesAPI = async (context: QueryFunctionContext<ClientesQueryKey>): Promise<Cliente[]> => {
  const [, searchTerm, tipoCliente] = context.queryKey;

  let query = supabase
    .from('clientes')
    .select(`
      id,
      nome_razao_social,
      dados_adicionais,
      unidades_consumidoras ( count )
    `)

  if (tipoCliente) {
    query = query.eq('dados_adicionais->>tipo', tipoCliente);
  }

  if (searchTerm) {
    query = query.or(
      `nome_razao_social.ilike.%${searchTerm}%,dados_adicionais->>email.ilike.%${searchTerm}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    console.error('Erro ao buscar clientes no Supabase:', error);
    toast.error('Falha ao carregar clientes: ' + error.message);
    throw new Error(error.message);
  }

  return data.map((cliente: ClienteFromDB) => ({
    id: cliente.id,
    nome: cliente.nome_razao_social,
    email: cliente.dados_adicionais?.email || '',
    telefone: cliente.dados_adicionais?.telefone || '',
    tipo: cliente.dados_adicionais?.tipo || 'PF', // Default para 'PF' ou ajuste conforme necessário
    ucsCount: (cliente.unidades_consumidoras && Array.isArray(cliente.unidades_consumidoras) && cliente.unidades_consumidoras.length > 0) 
              ? cliente.unidades_consumidoras[0].count 
              : (cliente.unidades_consumidoras && typeof cliente.unidades_consumidoras === 'object' && 'count' in cliente.unidades_consumidoras)
              ? cliente.unidades_consumidoras.count
              : 0,
  }));
};

// Placeholder para a função de API que deleta um cliente
const deleteClienteAPI = async (clienteId: string, ucsCount: number): Promise<{ success: boolean; message?: string }> => {
  console.log(`Tentando deletar cliente com ID: ${clienteId}, UCs: ${ucsCount}`);

  if (ucsCount > 0) {
    return { 
      success: false, 
      message: 'Este cliente possui unidades consumidoras associadas. Remova-as primeiro antes de excluir o cliente.' 
    };
  }
  
  await new Promise(resolve => setTimeout(resolve, 700));
  console.log(`Cliente com ID: ${clienteId} deletado (simulação).`);
  return { success: true }; 
};

// Custom hook for debounce
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

export default function ClientesList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [tipoClienteFilter, setTipoClienteFilter] = useState<string | undefined>(undefined);
  const [clienteParaDeletar, setClienteParaDeletar] = useState<Cliente | null>(null);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const queryInfo = useQuery<Cliente[], Error, Cliente[], ClientesQueryKey>({
    queryKey: ['clientes', debouncedSearchTerm, tipoClienteFilter],
    queryFn: fetchClientesAPI,
  });

  const deleteMutation = useMutation< { success: boolean; message?: string }, Error, { clienteId: string; ucsCount: number } >({
    mutationFn: (params) => deleteClienteAPI(params.clienteId, params.ucsCount),
    onSuccess: (data) => {
      if (data.success) {
        toast.success('Cliente excluído com sucesso!');
        queryClient.invalidateQueries({ queryKey: ['clientes'] });
        setClienteParaDeletar(null);
      } else {
        toast.error(data.message || 'Erro ao excluir cliente.');
      }
    },
    onError: (err: Error) => {
      toast.error(`Erro ao excluir cliente: ${err.message}`);
      setClienteParaDeletar(null);
    },
  });

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm((event.target as HTMLInputElement).value);
  };

  const handleTipoClienteChange = (value: string) => {
    setTipoClienteFilter(value === 'todos' ? undefined : value);
  };

  const handleDeleteCliente = (cliente: Cliente) => {
    setClienteParaDeletar(cliente);
  };

  const confirmDelete = () => {
    if (clienteParaDeletar) {
      deleteMutation.mutate({ clienteId: clienteParaDeletar.id, ucsCount: clienteParaDeletar.ucsCount });
    }
  };

  const tableRows = useMemo(() => {
    if (queryInfo.isLoading && queryInfo.fetchStatus !== 'idle') {
      return (
        <TableRow>
          <TableCell colSpan={6} className="h-60 text-center">
            <div className="flex flex-col items-center justify-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
              <p className="text-lg text-muted-foreground">Carregando clientes...</p>
            </div>
          </TableCell>
        </TableRow>
      );
    }

    if (queryInfo.isError) {
      return (
        <TableRow>
          <TableCell colSpan={6} className="h-60 text-center text-destructive text-lg">
             Erro ao carregar clientes: {queryInfo.error?.message || 'Erro desconhecido'}
             <p className="text-sm mt-2"><Button variant='outline' onClick={() => queryInfo.refetch()}>Tentar Novamente</Button></p>
          </TableCell>
        </TableRow>
      );
    }

    const clientes = queryInfo.data;

    if (!clientes || clientes.length === 0) {
    return (
        <TableRow>
          <TableCell colSpan={6} className="h-60 text-center text-muted-foreground">
            <div className="flex flex-col items-center justify-center">
                <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-xl font-semibold mb-1">Nenhum cliente encontrado.</p>
                { (debouncedSearchTerm || tipoClienteFilter) && 
                <p className="text-sm">Tente ajustar seus filtros ou <Button variant='link' className='p-0 h-auto text-base text-primary hover:underline' onClick={() => {setSearchTerm(''); setTipoClienteFilter(undefined);}}>limpar a busca</Button>.</p> 
                }
            </div>
          </TableCell>
        </TableRow>
      );
    }

    return clientes.map((cliente) => (
      <TableRow key={cliente.id} className="hover:bg-muted/20 transition-colors duration-150 ease-in-out data-[state=selected]:bg-primary/10">
        <TableCell className="font-medium text-foreground py-3.5 whitespace-nowrap px-6">{cliente.nome}</TableCell>
        <TableCell className="text-muted-foreground py-3.5 whitespace-nowrap px-6">
          <a href={`mailto:${cliente.email}`} className="hover:text-primary hover:underline transition-colors">
            {cliente.email}
          </a>
        </TableCell>
        <TableCell className="text-muted-foreground py-3.5 whitespace-nowrap px-6">{cliente.telefone}</TableCell>
        <TableCell className="text-center text-muted-foreground py-3.5 whitespace-nowrap px-6">
          <span className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full ${
            cliente.tipo === 'PJ' ? 'bg-sky-100 text-sky-700 border border-sky-200 dark:bg-sky-900/50 dark:text-sky-300 dark:border-sky-700' : 'bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-700'
          }`}>
            {cliente.tipo}
          </span>
        </TableCell>
        <TableCell className="text-center text-muted-foreground py-3.5 whitespace-nowrap px-6">
           <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-sm font-semibold bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
              {cliente.ucsCount}
           </span>
        </TableCell>
        <TableCell className="text-right py-3.5 pr-6 whitespace-nowrap sticky right-0 bg-card z-[1] group-hover:bg-muted/20 transition-colors duration-150 ease-in-out">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-9 w-9 p-0 text-muted-foreground data-[state=open]:bg-muted hover:bg-muted/50 focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-0">
                <span className="sr-only">Abrir menu</span>
                <MoreHorizontal className="h-4.5 w-4.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 shadow-lg border-border/80">
              <DropdownMenuItem onSelect={() => navigate(`/clientes/editar/${cliente.id}`)} className="cursor-pointer group">
                <Pencil className="mr-2.5 h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="group-hover:text-primary transition-colors">Editar Cliente</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => navigate(`/clientes/detalhes/${cliente.id}`)} className="cursor-pointer group">
                <Eye className="mr-2.5 h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="group-hover:text-primary transition-colors">Ver Detalhes</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => navigate(`/clientes/${cliente.id}/ucs`)} className="cursor-pointer group">
                <Plug className="mr-2.5 h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="group-hover:text-primary transition-colors">Ver UCs</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleDeleteCliente(cliente)} className="cursor-pointer group text-red-600 hover:!text-red-600 focus:!text-red-600 dark:text-red-500 dark:hover:!text-red-500 dark:focus:!text-red-500">
                <Trash2 className="mr-2.5 h-4 w-4 text-red-500 group-hover:text-red-600 transition-colors" />
                <span className="group-hover:text-red-600 transition-colors">Excluir Cliente</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>
    ));
  }, [queryInfo.data, queryInfo.isLoading, queryInfo.isError, queryInfo.fetchStatus, queryInfo.error, queryInfo.refetch, debouncedSearchTerm, tipoClienteFilter, navigate, queryInfo]);

  return (
    <AppShell 
        title="Gestão de Clientes" 
        description="Visualize, adicione, edite e gerencie os clientes da plataforma."
        headerActions={
          <Button 
            onClick={() => navigate('/clientes/novo')} 
            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-150 ease-in-out transform hover:scale-105 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-2"
          >
            <PlusCircle className="mr-2 h-5 w-5" />
            Adicionar Cliente
        </Button>
        }
    >
      <div className="w-full h-full px-2 md:px-4 py-4 flex flex-col gap-6">
        {/* Seção de Filtros e Busca */}
        <div className="p-5 bg-card border border-border/60 rounded-xl shadow-xl flex flex-col sm:flex-row gap-4 items-center sticky top-0 z-20 backdrop-blur-md bg-opacity-80 dark:bg-opacity-70">
          <div className="relative flex-grow w-full sm:max-w-sm md:max-w-md lg:max-w-lg">
            <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground/80" />
        <Input
              type="search"
              placeholder="Buscar por nome ou email..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="pl-11 pr-4 py-3 text-base border-border/70 focus:border-primary focus:ring-primary focus:ring-offset-0 focus:ring-2 transition-all duration-200 ease-in-out shadow-inner rounded-lg bg-background/50 hover:bg-background/70 focus:bg-background/90"
        />
      </div>
          <div className="w-full sm:w-auto">
            <Select value={tipoClienteFilter || 'todos'} onValueChange={handleTipoClienteChange}>
              <SelectTrigger className="w-full sm:w-[200px] py-3 text-base border-border/70 focus:border-primary focus:ring-primary focus:ring-offset-0 focus:ring-2 transition-all duration-200 ease-in-out shadow-inner rounded-lg bg-background/50 hover:bg-background/70 focus:bg-background/90">
                <SelectValue placeholder="Tipo de Cliente" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border/80 shadow-xl rounded-lg">
                <SelectItem value="todos" className="text-base cursor-pointer hover:bg-muted/50 focus:bg-muted/80 py-2.5">Todos os Tipos</SelectItem>
                <SelectItem value="PF" className="text-base cursor-pointer hover:bg-muted/50 focus:bg-muted/80 py-2.5">Pessoa Física (PF)</SelectItem>
                <SelectItem value="PJ" className="text-base cursor-pointer hover:bg-muted/50 focus:bg-muted/80 py-2.5">Pessoa Jurídica (PJ)</SelectItem>
              </SelectContent>
            </Select>
        </div>
        </div>

        {/* Tabela de Clientes */}
        <div className="overflow-hidden rounded-xl border border-border/60 shadow-2xl bg-card flex-grow">
          <div className="overflow-x-auto">
            <Table className="min-w-full divide-y divide-border/40">
              <TableHeader className="bg-muted/50 sticky top-0 z-10">
                <TableRow className="border-b-border/50">
                  <TableHead className="py-4 px-6 text-left text-sm font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Nome / Razão Social</TableHead>
                  <TableHead className="py-4 px-6 text-left text-sm font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Email</TableHead>
                  <TableHead className="py-4 px-6 text-left text-sm font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Telefone</TableHead>
                  <TableHead className="py-4 px-6 text-center text-sm font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Tipo</TableHead>
                  <TableHead className="py-4 px-6 text-center text-sm font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Nº UCs</TableHead>
                  <TableHead className="py-4 pr-6 text-right text-sm font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap sticky right-0 bg-muted/50">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border/30 bg-card">
                {tableRows}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Modal de Confirmação de Deleção */}
      <AlertDialog open={!!clienteParaDeletar} onOpenChange={(open) => !open && setClienteParaDeletar(null)}>
        <AlertDialogContent className="border-primary/20 shadow-2xl bg-card/90 backdrop-blur-md rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-semibold text-primary">Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground mt-2">
              {clienteParaDeletar && clienteParaDeletar.ucsCount > 0 ? (
                <>
                  <span className="font-semibold text-destructive">Atenção:</span> Este cliente possui {clienteParaDeletar.ucsCount} unidade(s) consumidora(s) associada(s). 
                  Você não pode excluir um cliente que tenha UCs vinculadas. Por favor, remova as UCs primeiro.
                </>
              ) : (
                `Tem certeza que deseja excluir o cliente "${clienteParaDeletar?.nome}"? Esta ação não pode ser desfeita.`
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6">
            <AlertDialogCancel asChild>
                <Button variant="outline" onClick={() => setClienteParaDeletar(null)} className="hover:bg-muted/80 transition-colors">Cancelar</Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
            <Button 
              variant="destructive"
                onClick={confirmDelete} 
                disabled={deleteMutation.isPending || (clienteParaDeletar?.ucsCount ?? 0) > 0}
                className="transition-colors"
            >
                {deleteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                Excluir
            </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
} 