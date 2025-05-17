
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Users, Zap, FileText, AlertCircle, PlusCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

interface DashboardStats {
  clienteCount: number;
  ucCount: number;
  faturaCount: number;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    clienteCount: 0,
    ucCount: 0,
    faturaCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;

      try {
        setLoading(true);

        // Get clientes count
        const { count: clienteCount, error: clientesError } = await supabase
          .from('clientes')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        if (clientesError) throw clientesError;

        // Get unidades_consumidoras count
        const { count: ucCount, error: ucsError } = await supabase
          .from('unidades_consumidoras')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        if (ucsError) throw ucsError;

        // Get faturas count
        const { count: faturaCount, error: faturasError } = await supabase
          .from('faturas')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        if (faturasError) throw faturasError;

        setStats({
          clienteCount: clienteCount || 0,
          ucCount: ucCount || 0,
          faturaCount: faturaCount || 0,
        });
      } catch (error) {
        console.error('Erro ao carregar estatísticas:', error);
        setError('Não foi possível carregar as estatísticas. Por favor, tente novamente mais tarde.');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-red-500 flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" /> Erro
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>{error}</p>
        </CardContent>
        <CardFooter>
          <Button onClick={() => window.location.reload()} variant="outline">
            Tentar novamente
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // Check if user is new (no data yet)
  const isNewUser = stats.clienteCount === 0 && stats.ucCount === 0 && stats.faturaCount === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Bem-vindo(a) ao ModularOne! Gerencie seus dados de energia em um só lugar.
        </p>
      </div>

      {isNewUser ? (
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle>Bem-vindo ao ModularOne!</CardTitle>
            <CardDescription>
              Vamos começar configurando seu ambiente. Siga os passos abaixo para começar a usar a plataforma.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4">
              <div className="flex items-start gap-4 p-4 rounded-lg bg-card border">
                <div className="bg-primary/10 p-2 rounded-full">
                  <PlusCircle className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium">Cadastre seus clientes</h3>
                  <p className="text-muted-foreground text-sm mt-1">
                    Comece cadastrando seus clientes para organizá-los melhor.
                  </p>
                  <Button asChild className="mt-4" variant="outline">
                    <Link to="/clientes">
                      Cadastrar Cliente
                    </Link>
                  </Button>
                </div>
              </div>
              
              <div className="flex items-start gap-4 p-4 rounded-lg bg-card border">
                <div className="bg-primary/10 p-2 rounded-full">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium">Adicione unidades consumidoras</h3>
                  <p className="text-muted-foreground text-sm mt-1">
                    Cadastre as unidades consumidoras para gerenciar seus dados de energia.
                  </p>
                  <Button asChild className="mt-4" variant="outline">
                    <Link to="/ucs">
                      Cadastrar UC
                    </Link>
                  </Button>
                </div>
              </div>
              
              <div className="flex items-start gap-4 p-4 rounded-lg bg-card border">
                <div className="bg-primary/10 p-2 rounded-full">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium">Faça upload das faturas</h3>
                  <p className="text-muted-foreground text-sm mt-1">
                    Envie as faturas de energia para análise e gestão.
                  </p>
                  <Button asChild className="mt-4" variant="outline">
                    <Link to="/faturas/upload">
                      Upload de Faturas
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Clientes</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.clienteCount}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Total de clientes cadastrados
                </p>
              </CardContent>
              <CardFooter>
                <Button asChild variant="ghost" className="w-full justify-start" size="sm">
                  <Link to="/clientes">
                    Ver todos os clientes
                  </Link>
                </Button>
              </CardFooter>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Unidades Consumidoras</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.ucCount}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Total de UCs cadastradas
                </p>
              </CardContent>
              <CardFooter>
                <Button asChild variant="ghost" className="w-full justify-start" size="sm">
                  <Link to="/ucs">
                    Ver todas as UCs
                  </Link>
                </Button>
              </CardFooter>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Faturas</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.faturaCount}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Total de faturas enviadas
                </p>
              </CardContent>
              <CardFooter>
                <Button asChild variant="ghost" className="w-full justify-start" size="sm">
                  <Link to="/faturas/upload">
                    Upload de faturas
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          </div>

          <div className="mt-6">
            <h2 className="text-xl font-bold tracking-tight mb-4">Atividades Recentes</h2>
            
            <Card>
              <CardHeader>
                <CardTitle>Faturas recentes</CardTitle>
                <CardDescription>
                  Lista das faturas enviadas recentemente.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Sem faturas recentes para exibir.
                </p>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
