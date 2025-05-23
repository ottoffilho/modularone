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
  CardFooter,
} from '@/components/ui/card';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Plus,
  FileText,
  CalendarClock,
  File,
  Download,
  Eye,
  MapPin,
  Building,
  User,
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

interface UC {
  id: string;
  identificador: string;
  endereco: string;
  distribuidora: string;
  cliente_id: string | null;
  created_at: string;
  updated_at: string | null;
  cliente_nome: string | null;
}

interface Fatura {
  id: string;
  data_cadastro: string;
  arquivo_pdf: string;
  status: string;
  created_at: string;
}

export default function UCDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [uc, setUc] = useState<UC | null>(null);
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    const loadUCDetails = async () => {
      if (!id || !user) return;

      try {
        setLoading(true);

        // Get UC data
        const { data: ucData, error: ucError } = await supabase
          .from('unidades_consumidoras')
          .select(`
            *,
            clientes:cliente_id (nome_razao_social)
          `)
          .eq('id', id)
          .eq('proprietario_user_id', user.id)
          .single();

        if (ucError) throw ucError;
        
        if (!ucData) {
          toast({
            title: 'Unidade consumidora não encontrada',
            description: 'A UC que você está tentando visualizar não existe ou você não tem permissão para acessá-la.',
            variant: 'destructive',
          });
          navigate('/ucs');
          return;
        }

        // Format UC data
        setUc({
          ...ucData,
          cliente_nome: ucData.clientes?.nome_razao_social || null,
        });

        // Get faturas associated with the UC
        const { data: faturasData, error: faturasError } = await supabase
          .from('faturas')
          .select('*')
          .eq('unidade_consumidora_id', id)
          .eq('proprietario_user_id', user.id)
          .order('data_cadastro', { ascending: false });

        if (faturasError) throw faturasError;

        setFaturas(faturasData);
      } catch (error) {
        console.error('Erro ao carregar detalhes da UC:', error);
        toast({
          title: 'Erro',
          description: 'Não foi possível carregar os detalhes da unidade consumidora.',
          variant: 'destructive',
        });
        navigate('/ucs');
      } finally {
        setLoading(false);
      }
    };

    loadUCDetails();
  }, [id, user, navigate, toast]);

  const handleDelete = async () => {
    if (!uc || !user) return;

    try {
      setLoading(true);

      // Check if UC has associated faturas
      if (faturas.length > 0) {
        toast({
          title: 'Não é possível excluir',
          description: 'Esta unidade consumidora possui faturas associadas. Remova as faturas primeiro.',
          variant: 'destructive',
        });
        setDeleteDialogOpen(false);
        return;
      }

      // Delete the UC
      const { error } = await supabase
        .from('unidades_consumidoras')
        .delete()
        .eq('id', uc.id)
        .eq('proprietario_user_id', user.id);

      if (error) throw error;

      toast({
        title: 'Unidade Consumidora removida',
        description: `A UC ${uc.identificador} foi removida com sucesso.`,
      });
      
      navigate('/ucs');
    } catch (error) {
      console.error('Erro ao excluir unidade consumidora:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir a unidade consumidora.',
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

  if (!uc) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <Button
            variant="ghost"
            className="mb-2"
            onClick={() => navigate('/ucs')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para a lista
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">
            UC: {uc.identificador}
          </h1>
          <p className="text-muted-foreground mt-2">
            Detalhes da unidade consumidora e faturas associadas.
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to={`/ucs/${id}/editar`}>
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

      {/* UC Details */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhes da Unidade Consumidora</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <div className="bg-primary/10 p-2 rounded-full">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Identificador</dt>
                <dd className="mt-1">{uc.identificador}</dd>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="bg-primary/10 p-2 rounded-full">
                <MapPin className="h-4 w-4 text-primary" />
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Endereço</dt>
                <dd className="mt-1">{uc.endereco}</dd>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="bg-primary/10 p-2 rounded-full">
                <Building className="h-4 w-4 text-primary" />
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Distribuidora</dt>
                <dd className="mt-1">{uc.distribuidora}</dd>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="bg-primary/10 p-2 rounded-full">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Cliente</dt>
                <dd className="mt-1">
                  {uc.cliente_id ? (
                    <Link 
                      to={`/clientes/${uc.cliente_id}`}
                      className="text-primary hover:underline"
                    >
                      {uc.cliente_nome}
                    </Link>
                  ) : (
                    "Não associado a um cliente"
                  )}
                </dd>
              </div>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Faturas */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold tracking-tight">Faturas</h2>
          <Button asChild>
            <Link to={`/faturas/upload?uc=${id}`}>
              <Plus className="mr-2 h-4 w-4" /> Nova Fatura
            </Link>
          </Button>
        </div>

        {faturas.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Nenhuma fatura cadastrada</CardTitle>
              <CardDescription>
                Esta unidade consumidora ainda não possui faturas cadastradas.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link to={`/faturas/upload?uc=${id}`}>
                  <Plus className="mr-2 h-4 w-4" /> Enviar Fatura
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data de Cadastro</TableHead>
                  <TableHead>Arquivo PDF</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {faturas.map((fatura) => (
                  <TableRow key={fatura.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <CalendarClock className="h-4 w-4 text-primary" />
                        {fatura.data_cadastro}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <File className="h-4 w-4 text-muted-foreground" />
                        {fatura.arquivo_pdf}
                      </div>
                    </TableCell>
                    <TableCell>{fatura.status}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" asChild>
                          <a 
                            href={fatura.arquivo_pdf} 
                            target="_blank" 
                            rel="noopener noreferrer"
                          >
                            <Eye className="h-4 w-4" />
                          </a>
                        </Button>
                        <Button variant="ghost" size="icon" asChild>
                          <a 
                            href={fatura.arquivo_pdf} 
                            download={fatura.arquivo_pdf}
                          >
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => {
                            // Placeholder for delete fatura functionality
                            toast({
                              title: "Funcionalidade em desenvolvimento",
                              description: "A exclusão de faturas será implementada em breve.",
                            });
                          }}
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
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir a unidade consumidora{' '}
              <span className="font-medium">
                {uc.identificador}
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
