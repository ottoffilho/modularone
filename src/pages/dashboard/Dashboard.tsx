import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AnimatedLogoLoader } from '@/components/ui/AnimatedLogoLoader';
import { Users, Zap, FileText, AlertCircle, PlusCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';

interface DashboardStats {
  clienteCount: number;
  ucCount: number;
  // faturaCount: number; // Comentado temporariamente
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    clienteCount: 0,
    ucCount: 0,
    // faturaCount: 0, // Comentado temporariamente
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;

      try {
        setLoading(true);

        // Get clientes count
        const { count: clienteCount, error: clientesError } = await supabase
          .from('clientes')
          .select('*', { count: 'exact', head: true })
          .eq('proprietario_user_id', user.id);

        if (clientesError) throw clientesError;

        // Get unidades_consumidoras count
        const { count: ucCount, error: ucsError } = await supabase
          .from('unidades_consumidoras')
          .select('*', { count: 'exact', head: true })
          .eq('proprietario_user_id', user.id);

        if (ucsError) throw ucsError;

        // Get faturas count - TEMPORARIAMENTE COMENTADO
        /*
        const { count: faturaCount, error: faturasError } = await supabase
          .from('faturas')
          .select('*', { count: 'exact', head: true })
          .eq('proprietario_user_id', user.id);

        if (faturasError) throw faturasError;
        */

        setStats({
          clienteCount: clienteCount || 0,
          ucCount: ucCount || 0,
          // faturaCount: faturaCount || 0, // Comentado temporariamente
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
      <div className="flex flex-col items-center justify-center h-full min-h-[calc(100vh-8rem)]">
        <AnimatedLogoLoader size="lg" message="Carregando seus dados..." />
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
  const isNewUser = stats.clienteCount === 0 && stats.ucCount === 0; // Removido faturaCount da condição

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-800 dark:text-gray-100">Dashboard</h1>
        <p className="text-muted-foreground mt-2 text-lg">
          Bem-vindo(a) ao <span className="font-semibold text-[#daa916]">ModularOne</span>! Gerencie seus dados de energia em um só lugar.
        </p>
        <hr className="my-6 border-gray-200 dark:border-gray-700" />
      </div>

      {isNewUser ? (
        <Card className="bg-[#daa916]/5 border-[#daa916]/30 shadow-lg rounded-xl overflow-hidden">
          <CardHeader className="p-6">
            <CardTitle className="text-2xl font-semibold text-gray-800 dark:text-gray-100">Bem-vindo ao ModularOne!</CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-300 mt-1 text-base">
              Parece que você está começando. Siga os passos abaixo para configurar sua plataforma e desbloquear todo o potencial do ModularOne.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="flex items-start gap-4 p-5 rounded-lg bg-card border-2 border-transparent hover:border-[#daa916]/50 hover:shadow-xl transition-all duration-300 cursor-pointer" onClick={() => navigate('/clientes')}>
              <div className="bg-[#daa916]/10 p-3 rounded-full">
                <PlusCircle className="h-7 w-7 text-[#daa916]" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-gray-700 dark:text-gray-200">Cadastre seus Clientes</h3>
                <p className="text-muted-foreground text-sm mt-1">
                  Comece adicionando seus clientes para uma organização eficiente e acesso rápido às informações.
                </p>
                <Button asChild className="mt-4 bg-[#daa916] text-primary-foreground hover:bg-[#daa916]/90" size="sm">
                  <Link to="/clientes">
                    Ir para Clientes
                  </Link>
                </Button>
              </div>
            </div>
            
            <div className="flex items-start gap-4 p-5 rounded-lg bg-card border-2 border-transparent hover:border-[#daa916]/50 hover:shadow-xl transition-all duration-300 cursor-pointer" onClick={() => navigate('/ucs')}>
              <div className="bg-[#daa916]/10 p-3 rounded-full">
                <Zap className="h-7 w-7 text-[#daa916]" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-gray-700 dark:text-gray-200">Adicione Unidades Consumidoras</h3>
                <p className="text-muted-foreground text-sm mt-1">
                  Cadastre as UCs para começar a monitorar o consumo e a geração de energia.
                </p>
                <Button asChild className="mt-4 bg-[#daa916] text-primary-foreground hover:bg-[#daa916]/90" size="sm">
                  <Link to="/ucs">
                    Ir para UCs
                  </Link>
                </Button>
              </div>
            </div>
            
            <div className="flex items-start gap-4 p-5 rounded-lg bg-card border-2 border-transparent hover:border-[#daa916]/50 hover:shadow-xl transition-all duration-300 cursor-pointer" onClick={() => navigate('/faturas/upload')}>
              <div className="bg-[#daa916]/10 p-3 rounded-full">
                <FileText className="h-7 w-7 text-[#daa916]" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-gray-700 dark:text-gray-200">Faça Upload das Faturas</h3>
                <p className="text-muted-foreground text-sm mt-1">
                  Envie as faturas de energia para que nossa IA extraia os dados e gere insights valiosos.
                </p>
                <Button asChild className="mt-4 bg-[#daa916] text-primary-foreground hover:bg-[#daa916]/90" size="sm">
                  <Link to="/faturas/upload">
                    Upload de Faturas
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card className="shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl border border-slate-200 dark:border-slate-700 border-t-4 border-t-[#daa916]">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-300">Clientes Ativos</CardTitle>
                <Users className="h-5 w-5 text-[#daa916]" />
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <div className="text-3xl font-bold text-[#daa916]">{stats.clienteCount}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Total de clientes cadastrados na plataforma.
                </p>
              </CardContent>
              <CardFooter className="px-4 pb-4 pt-0">
                <Button asChild variant="outline" className="w-full justify-center text-[#daa916] border-[#daa916] hover:bg-[#daa916]/10 hover:text-[#daa916]" size="sm">
                  <Link to="/clientes">
                    Gerenciar Clientes
                  </Link>
                </Button>
              </CardFooter>
            </Card>
            
            <Card className="shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl border border-slate-200 dark:border-slate-700 border-t-4 border-t-[#daa916]">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-300">Unidades Consumidoras</CardTitle>
                <Zap className="h-5 w-5 text-[#daa916]" />
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <div className="text-3xl font-bold text-[#daa916]">{stats.ucCount}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Total de UCs monitoradas.
                </p>
              </CardContent>
              <CardFooter className="px-4 pb-4 pt-0">
                <Button asChild variant="outline" className="w-full justify-center text-[#daa916] border-[#daa916] hover:bg-[#daa916]/10 hover:text-[#daa916]" size="sm">
                  <Link to="/ucs">
                    Gerenciar UCs
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          </div>

          {/* Seção de Atividades Recentes (Faturas) - TEMPORARIAMENTE COMENTADA SE DEPENDER DE DADOS DE FATURAS
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
          */}
        </>
      )}
    </div>
  );
}
