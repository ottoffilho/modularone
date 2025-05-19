import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AppShell } from '@/components/layout/AppShell';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from 'sonner';
import { PlusCircle, Search, MoreHorizontal, Eye, Edit, Trash2, Loader2, SunMedium } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

// Tipo para a planta solar
interface PlantaSolar {
  id: string;
  nome: string;
  potencia_instalada_dc_kwp: number;
  status_planta: string;
  data_conexao_rede: string | null;
  endereco_cidade: string | null;
  endereco_estado: string | null;
}

// Hook para debounce do campo de busca
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Função que busca as plantas solares no Supabase
const fetchPlantasSolares = async (userId: string, searchTerm: string): Promise<PlantaSolar[]> => {
  let query = supabase
    .from('plantas_solares')
    .select(`
      id,
      nome,
      potencia_instalada_dc_kwp,
      status_planta,
      data_conexao_rede,
      endereco_cidade,
      endereco_estado
    `)
    .eq('user_id', userId)
    .order('nome');

  if (searchTerm) {
    query = query.ilike('nome', `%${searchTerm}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Erro ao buscar plantas solares:', error);
    throw new Error('Não foi possível buscar as plantas solares');
  }

  return data || [];
};

// Função para deletar uma planta solar
const deletePlantaSolar = async (plantaId: string, userId: string): Promise<{ success: boolean; message?: string }> => {
  try {
    // TODO: Verificar se há UCs associadas a esta planta antes de excluir
    
    const { error } = await supabase
      .from('plantas_solares')
      .delete()
      .eq('id', plantaId)
      .eq('user_id', userId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Erro ao excluir planta solar:', error);
    return { success: false, message: 'Não foi possível excluir a planta solar' };
  }
};

export default function PlantasSolaresList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [plantaParaDeletar, setPlantaParaDeletar] = useState<PlantaSolar | null>(null);
  
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Query para buscar plantas solares
  const queryInfo = useQuery<PlantaSolar[]>({
    queryKey: ['plantas_solares', debouncedSearchTerm, user?.id],
    queryFn: () => fetchPlantasSolares(user?.id || '', debouncedSearchTerm),
    enabled: !!user,
  });

  // Mutation para deletar planta solar
  const deleteMutation = useMutation({
    mutationFn: (plantaId: string) => deletePlantaSolar(plantaId, user?.id || ''),
    onSuccess: (data) => {
      if (data.success) {
        toast.success('Planta solar excluída com sucesso!');
        queryClient.invalidateQueries({ queryKey: ['plantas_solares'] });
        setPlantaParaDeletar(null);
      } else {
        toast.error(data.message || 'Erro ao excluir planta solar.');
      }
    },
    onError: (err: Error) => {
      toast.error(`Erro ao excluir planta solar: ${err.message}`);
      setPlantaParaDeletar(null);
    },
  });

  // Handler para mudança no campo de busca
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  // Handler para iniciar o processo de deleção
  const handleDeletePlanta = (planta: PlantaSolar) => {
    setPlantaParaDeletar(planta);
  };

  // Confirmar a deleção
  const confirmDelete = () => {
    if (plantaParaDeletar) {
      deleteMutation.mutate(plantaParaDeletar.id);
    }
  };

  // Memo para as linhas da tabela
  const tableRows = useMemo(() => {
    if (queryInfo.isLoading) {
      return (
        <TableRow>
          <TableCell colSpan={6} className="h-60 text-center">
            <div className="flex flex-col items-center justify-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
              <p className="text-lg text-muted-foreground">Carregando plantas solares...</p>
            </div>
          </TableCell>
        </TableRow>
      );
    }

    if (queryInfo.isError) {
      return (
        <TableRow>
          <TableCell colSpan={6} className="h-60 text-center text-destructive text-lg">
             Erro ao carregar plantas solares: {queryInfo.error?.message || 'Erro desconhecido'}
             <p className="text-sm mt-2">
               <Button variant='outline' onClick={() => queryInfo.refetch()}>Tentar Novamente</Button>
             </p>
          </TableCell>
        </TableRow>
      );
    }

    const plantas = queryInfo.data;

    if (!plantas || plantas.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={6} className="h-60 text-center text-muted-foreground">
            <div className="flex flex-col items-center justify-center">
              <SunMedium className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-xl font-semibold mb-1">Nenhuma planta solar encontrada.</p>
              {debouncedSearchTerm && 
                <p className="text-sm">
                  Tente ajustar seu termo de busca ou <Button variant='link' className='p-0 h-auto text-base text-primary hover:underline' onClick={() => setSearchTerm('')}>limpar a busca</Button>.
                </p>
              }
              {!debouncedSearchTerm && 
                <p className="text-sm">
                  Clique em 'Nova Planta Solar' para começar.
                </p>
              }
            </div>
          </TableCell>
        </TableRow>
      );
    }

    return plantas.map((planta) => (
      <TableRow key={planta.id} className="hover:bg-muted/20 transition-colors duration-150 ease-in-out data-[state=selected]:bg-primary/10">
        <TableCell className="font-medium text-foreground py-3.5 whitespace-nowrap px-6">{planta.nome}</TableCell>
        <TableCell className="text-center text-muted-foreground py-3.5 whitespace-nowrap px-6">
          {planta.potencia_instalada_dc_kwp?.toFixed(2) || '-'} kWp
        </TableCell>
        <TableCell className="text-center text-muted-foreground py-3.5 whitespace-nowrap px-6">
          <span className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full ${
            planta.status_planta === 'ATIVA' 
              ? 'bg-green-100 text-green-700 border border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700' 
              : planta.status_planta === 'INATIVA'
                ? 'bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700'
                : planta.status_planta === 'MANUTENCAO'
                  ? 'bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-700'
                  : 'bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700'
          }`}>
            {planta.status_planta === 'MANUTENCAO' ? 'MANUTENÇÃO' : planta.status_planta}
          </span>
        </TableCell>
        <TableCell className="text-center text-muted-foreground py-3.5 whitespace-nowrap px-6">
          {planta.data_conexao_rede 
            ? new Date(planta.data_conexao_rede).toLocaleDateString() 
            : '-'}
        </TableCell>
        <TableCell className="text-center text-muted-foreground py-3.5 whitespace-nowrap px-6">
          {planta.endereco_cidade && planta.endereco_estado 
            ? `${planta.endereco_cidade}/${planta.endereco_estado}`
            : '-'}
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
              <DropdownMenuItem onSelect={() => navigate(`/plantas-solares/${planta.id}`)} className="cursor-pointer group">
                <Eye className="mr-2.5 h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="group-hover:text-primary transition-colors">Ver Detalhes</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => navigate(`/plantas-solares/${planta.id}/editar`)} className="cursor-pointer group">
                <Edit className="mr-2.5 h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="group-hover:text-primary transition-colors">Editar</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleDeletePlanta(planta)} className="cursor-pointer group text-red-600 hover:!text-red-600 focus:!text-red-600 dark:text-red-500 dark:hover:!text-red-500 dark:focus:!text-red-500">
                <Trash2 className="mr-2.5 h-4 w-4 text-red-500 group-hover:text-red-600 transition-colors" />
                <span className="group-hover:text-red-600 transition-colors">Excluir</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>
    ));
  }, [queryInfo.data, queryInfo.isLoading, queryInfo.isError, queryInfo.error, queryInfo.refetch, debouncedSearchTerm, navigate]);

  return (
    <AppShell 
      title="Gestão de Plantas Solares" 
      description="Visualize, adicione, edite e gerencie todas as suas plantas solares."
      headerActions={
        <Button 
          onClick={() => navigate('/plantas-solares/novo')} 
          className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-150 ease-in-out transform hover:scale-105 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-2"
        >
          <PlusCircle className="mr-2 h-5 w-5" />
          Nova Planta Solar
        </Button>
      }
    >
      <div className="w-full h-full px-2 md:px-4 py-4 flex flex-col gap-6">
        {/* Seção de Busca */}
        <div className="p-5 bg-card border border-border/60 rounded-xl shadow-xl flex flex-col sm:flex-row gap-4 items-center sticky top-0 z-20 backdrop-blur-md bg-opacity-80 dark:bg-opacity-70">
          <div className="relative flex-grow w-full sm:max-w-lg">
            <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground/80" />
            <Input
              type="search"
              placeholder="Buscar plantas solares por nome..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="pl-11 pr-4 py-3 text-base border-border/70 focus:border-primary focus:ring-primary focus:ring-offset-0 focus:ring-2 transition-all duration-200 ease-in-out shadow-inner rounded-lg bg-background/50 hover:bg-background/70 focus:bg-background/90"
            />
          </div>
        </div>

        {/* Tabela de Plantas Solares */}
        <div className="overflow-hidden rounded-xl border border-border/60 shadow-2xl bg-card flex-grow">
          <div className="overflow-x-auto">
            <Table className="min-w-full divide-y divide-border/40">
              <TableHeader className="bg-muted/50 sticky top-0 z-10">
                <TableRow className="border-b-border/50">
                  <TableHead className="py-4 px-6 text-left text-sm font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Nome da Planta</TableHead>
                  <TableHead className="py-4 px-6 text-center text-sm font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Potência (kWp)</TableHead>
                  <TableHead className="py-4 px-6 text-center text-sm font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Status</TableHead>
                  <TableHead className="py-4 px-6 text-center text-sm font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Data Conexão</TableHead>
                  <TableHead className="py-4 px-6 text-center text-sm font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Localização</TableHead>
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
      <AlertDialog open={!!plantaParaDeletar} onOpenChange={(open) => !open && setPlantaParaDeletar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a planta solar "{plantaParaDeletar?.nome}"?
              <br /><br />
              <strong className="text-destructive">Esta ação não pode ser desfeita.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                'Sim, excluir'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
} 