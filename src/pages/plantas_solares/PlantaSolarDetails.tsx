import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { ArrowLeft, Edit, CalendarRange, MapPin, Zap, BadgeInfo, SquareStack } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

// Interface para os dados da planta solar
interface PlantaSolar {
  id: string;
  nome: string;
  identificacao_concessionaria: string | null;
  endereco_cep: string | null;
  endereco_logradouro: string | null;
  endereco_numero: string | null;
  endereco_bairro: string | null;
  endereco_cidade: string | null;
  endereco_estado: string | null;
  latitude: number | null;
  longitude: number | null;
  potencia_instalada_dc_kwp: number;
  data_conexao_rede: string | null;
  status_planta: string;
  observacoes: string | null;
  created_at: string;
  updated_at: string | null;
}

export default function PlantaSolarDetails() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [plantaSolar, setPlantaSolar] = useState<PlantaSolar | null>(null);
  
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const fetchPlantaSolar = async () => {
      if (!user) return;
      
      try {
        setLoading(true);
        
        const { data, error } = await supabase
          .from('plantas_solares')
          .select('*')
          .eq('id', id)
          .eq('user_id', user.id)
          .single();
          
        if (error) throw error;
        
        if (!data) {
          toast({
            title: 'Planta solar não encontrada',
            description: 'A planta solar que você está tentando visualizar não existe ou você não tem permissão para acessá-la.',
            variant: 'destructive',
          });
          navigate('/plantas-solares');
          return;
        }
        
        setPlantaSolar(data);
      } catch (error) {
        console.error('Erro ao carregar planta solar:', error);
        toast({
          title: 'Erro',
          description: 'Não foi possível carregar os dados da planta solar.',
          variant: 'destructive',
        });
        navigate('/plantas-solares');
      } finally {
        setLoading(false);
      }
    };
    
    fetchPlantaSolar();
  }, [id, user, navigate, toast]);

  // Formatador de data
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Não informada';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  // Função para formatar o endereço completo
  const formatEndereco = () => {
    if (!plantaSolar) return 'Não informado';
    
    const parts = [];
    
    if (plantaSolar.endereco_logradouro) {
      parts.push(plantaSolar.endereco_logradouro);
      
      if (plantaSolar.endereco_numero) {
        parts[0] += `, ${plantaSolar.endereco_numero}`;
      }
    }
    
    if (plantaSolar.endereco_bairro) {
      parts.push(plantaSolar.endereco_bairro);
    }
    
    if (plantaSolar.endereco_cidade) {
      let cityState = plantaSolar.endereco_cidade;
      
      if (plantaSolar.endereco_estado) {
        cityState += `/${plantaSolar.endereco_estado}`;
      }
      
      parts.push(cityState);
    }
    
    if (plantaSolar.endereco_cep) {
      parts.push(`CEP: ${plantaSolar.endereco_cep}`);
    }
    
    return parts.length > 0 ? parts.join(' - ') : 'Não informado';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[70vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!plantaSolar) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
        <h1 className="text-2xl font-bold">Planta solar não encontrada</h1>
        <Button onClick={() => navigate('/plantas-solares')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Lista
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Detalhes da Planta Solar
          </h1>
          <p className="text-muted-foreground mt-2">
            Visualizando informações detalhadas da planta solar.
          </p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            onClick={() => navigate('/plantas-solares')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
          <Button
            onClick={() => navigate(`/plantas-solares/${id}/editar`)}
          >
            <Edit className="h-4 w-4 mr-2" /> Editar Planta
          </Button>
        </div>
      </div>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold flex items-center">
            <SquareStack className="mr-2 h-6 w-6 text-primary" />
            {plantaSolar.nome}
          </CardTitle>
          <CardDescription>
            {plantaSolar.identificacao_concessionaria ? 
              `Identificação na concessionária: ${plantaSolar.identificacao_concessionaria}` : 
              'Sem identificação na concessionária'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status e Potência */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col">
              <h3 className="text-sm font-medium text-muted-foreground flex items-center mb-1">
                <BadgeInfo className="mr-2 h-4 w-4" /> Status
              </h3>
              <p className="text-lg font-semibold">
                <span className={`px-3 py-1 text-sm font-bold uppercase tracking-wider rounded-full ${
                  plantaSolar.status_planta === 'ATIVA' 
                    ? 'bg-green-100 text-green-700 border border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700' 
                    : plantaSolar.status_planta === 'INATIVA'
                      ? 'bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700'
                      : plantaSolar.status_planta === 'MANUTENCAO'
                        ? 'bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-700'
                        : 'bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700'
                }`}>
                  {plantaSolar.status_planta === 'MANUTENCAO' ? 'MANUTENÇÃO' : plantaSolar.status_planta}
                </span>
              </p>
            </div>
            <div className="flex flex-col">
              <h3 className="text-sm font-medium text-muted-foreground flex items-center mb-1">
                <Zap className="mr-2 h-4 w-4" /> Potência Instalada
              </h3>
              <p className="text-lg font-semibold">
                {plantaSolar.potencia_instalada_dc_kwp.toFixed(2)} kWp
              </p>
            </div>
          </div>

          {/* Data de Conexão e Localização */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col">
              <h3 className="text-sm font-medium text-muted-foreground flex items-center mb-1">
                <CalendarRange className="mr-2 h-4 w-4" /> Data de Conexão à Rede
              </h3>
              <p className="text-base">
                {plantaSolar.data_conexao_rede ? formatDate(plantaSolar.data_conexao_rede) : 'Não informada'}
              </p>
            </div>
            <div className="flex flex-col">
              <h3 className="text-sm font-medium text-muted-foreground flex items-center mb-1">
                <MapPin className="mr-2 h-4 w-4" /> Localização
              </h3>
              <p className="text-base">
                {formatEndereco()}
              </p>
            </div>
          </div>

          {/* Coordenadas */}
          {(plantaSolar.latitude || plantaSolar.longitude) && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">
                Coordenadas
              </h3>
              <p className="text-base">
                {plantaSolar.latitude ? `Latitude: ${plantaSolar.latitude}` : ''} 
                {plantaSolar.latitude && plantaSolar.longitude ? ' / ' : ''}
                {plantaSolar.longitude ? `Longitude: ${plantaSolar.longitude}` : ''}
              </p>
            </div>
          )}

          {/* Observações */}
          {plantaSolar.observacoes && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">
                Observações
              </h3>
              <div className="p-4 bg-muted/40 rounded-md text-base">
                {plantaSolar.observacoes}
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="border-t pt-5 text-sm text-muted-foreground">
          <div className="w-full flex flex-col sm:flex-row sm:justify-between gap-1">
            <div>Data de cadastro: {formatDate(plantaSolar.created_at)}</div>
            {plantaSolar.updated_at && (
              <div>Última atualização: {formatDate(plantaSolar.updated_at)}</div>
            )}
          </div>
        </CardFooter>
      </Card>

      {/* Placeholder para futuras funcionalidades */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">Equipamentos Monitorados</CardTitle>
          <CardDescription>
            Esta seção mostrará os equipamentos associados a esta planta solar. Esta funcionalidade estará disponível em breve.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-6 flex justify-center items-center border border-dashed rounded-md">
            <p className="text-muted-foreground">
              Funcionalidade em desenvolvimento.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 