import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogClose 
} from '@/components/ui/dialog';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { Checkbox } from "@/components/ui/checkbox"
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { Loader2, AlertCircle, Check, X, XCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

// Tipos que vêm das Edge Functions
interface ConfiguredIntegration {
  fabricante_id: string;
  fabricante_nome: string;
  // Outros campos se a EF manage-user-service-credentials retornar mais info útil
}

interface PlantaExternaPadronizada {
  id_planta_fabricante: string;
  nome_planta_fabricante: string;
  potencia_instalada_kwp?: number;
  localizacao_string?: string;
  dados_adicionais_fabricante?: Record<string, any>; 
}

// Tipo para o que será inserido no DB do ModularOne
interface PlantaSolarInsert {
  user_id: string;
  nome: string;
  fabricante_id: string;
  id_externo_planta: string; // Para rastrear a origem e evitar duplicatas
  potencia_instalada_dc_kwp?: number;
  localizacao?: string;
  // Outros campos da tabela plantas_solares
  dados_importacao_api?: Json; // Para armazenar dados_adicionais_fabricante
}

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

interface ImportPlantsDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onPlantsImported: () => void;
}

export function ImportPlantsDialog({ 
  isOpen, 
  setIsOpen, 
  onPlantsImported 
}: ImportPlantsDialogProps) {
  const { user, session } = useAuth();

  const [configuredIntegrations, setConfiguredIntegrations] = useState<ConfiguredIntegration[]>([]);
  const [selectedFabricanteId, setSelectedFabricanteId] = useState<string | null>(null);
  const [isLoadingIntegrations, setIsLoadingIntegrations] = useState(false);
  
  const [externalPlantsList, setExternalPlantsList] = useState<PlantaExternaPadronizada[]>([]);
  const [isLoadingPlants, setIsLoadingPlants] = useState(false);
  const [errorLoadingPlants, setErrorLoadingPlants] = useState<string | null>(null);

  const [selectedPlantsToImport, setSelectedPlantsToImport] = useState<Record<string, PlantaExternaPadronizada>>({}); // Usar um objeto para fácil lookup e toggle
  const [isImporting, setIsImporting] = useState(false);
  const [importStep, setImportStep] = useState<1 | 2>(1); // 1: Selecionar Fabricante, 2: Listar/Selecionar Plantas

  // 1. Carregar Integrações Configuradas (ao abrir o dialog)
  useEffect(() => {
    if (isOpen && user && session) {
      setImportStep(1); // Resetar para o passo 1 ao abrir
      setSelectedFabricanteId(null);
      setExternalPlantsList([]);
      setSelectedPlantsToImport({});
      setErrorLoadingPlants(null);

      const fetchConfiguredIntegrations = async () => {
        setIsLoadingIntegrations(true);
        try {
          const { data, error } = await supabase.functions.invoke<ConfiguredIntegration[]>(
            'manage-user-integration-credentials',
            {
              method: 'GET',
              headers: { Authorization: `Bearer ${session.access_token}` },
            }
          );
          if (error) throw error;
          // A EF deve retornar apenas as válidas ou adicionar um filtro aqui, se necessário.
          // Ex: data?.filter(int => int.status_validacao === 'VALIDO')
          setConfiguredIntegrations(data || []);
        } catch (err: any) {
          console.error("Erro ao buscar integrações configuradas:", err);
          toast.error("Falha ao Carregar Fabricantes", { description: err.message || "Não foi possível buscar os fabricantes configurados." });
          setConfiguredIntegrations([]);
        } finally {
          setIsLoadingIntegrations(false);
        }
      };
      fetchConfiguredIntegrations();
    }
  }, [isOpen, user, session]);

  // 2. Buscar Plantas da API Externa
  const handleFetchExternalPlants = async () => {
    if (!selectedFabricanteId || !session?.access_token) {
      toast.warning("Seleção Necessária", { description: "Por favor, selecione um fabricante primeiro." });
      return;
    }
    setIsLoadingPlants(true);
    setErrorLoadingPlants(null);
    setExternalPlantsList([]); // Limpar lista anterior
    setSelectedPlantsToImport({});
    try {
      const { data, error } = await supabase.functions.invoke<PlantaExternaPadronizada[]>(
        'get-external-plant-list',
        {
          method: 'POST', // Conforme definido na EF
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: { fabricante_id: selectedFabricanteId }
        }
      );
      if (error) throw error;
      setExternalPlantsList(data || []);
      if (data && data.length > 0) {
        setImportStep(2);
      } else {
        toast.info("Nenhuma Planta Encontrada", { description: "Nenhuma planta foi encontrada para este fabricante na API externa ou você não tem acesso a elas." });
      }
    } catch (err: any) {
      console.error("Erro ao buscar plantas da API externa:", err);
      toast.error("Falha ao Buscar Plantas", { description: err.message || "Não foi possível buscar as plantas do fabricante selecionado." });
      setErrorLoadingPlants(err.message || "Erro ao carregar plantas.");
    } finally {
      setIsLoadingPlants(false);
    }
  };

  const handleTogglePlantSelection = (plant: PlantaExternaPadronizada) => {
    setSelectedPlantsToImport(prev => {
      const newSelection = { ...prev };
      if (newSelection[plant.id_planta_fabricante]) {
        delete newSelection[plant.id_planta_fabricante];
      } else {
        newSelection[plant.id_planta_fabricante] = plant;
      }
      return newSelection;
    });
  };

  const selectedPlantsArray = Object.values(selectedPlantsToImport);

  // 3. Importar Plantas Selecionadas
  const handleImportSelectedPlants = async () => {
    if (selectedPlantsArray.length === 0 || !user?.id ) {
      toast.warning("Nenhuma Planta Selecionada", { description: "Selecione ao menos uma planta para importar." });
      return;
    }
    setIsImporting(true);

    // Mapear as plantas selecionadas para o formato esperado pela EF 'import-selected-plants'
    const plantasParaEnviar = selectedPlantsArray.map(p => ({
      fabricante_id: p.dados_adicionais_fabricante?.original_fabricante_id || selectedFabricanteId, // Preferir ID original se disponível, senão o selecionado no dialog
      id_planta_fabricante: p.id_planta_fabricante,
      nome_planta_fabricante: p.nome_planta_fabricante,
      potencia_instalada_kwp: p.potencia_instalada_kwp,
      localizacao_string: p.localizacao_string,
      dados_adicionais_fabricante: p.dados_adicionais_fabricante,
    }));

    if (!plantasParaEnviar.every(p => p.fabricante_id)) {
        toast.error("Erro Interno", { description: "ID do fabricante ausente para uma ou mais plantas selecionadas. Não foi possível importar." });
        setIsImporting(false);
        return;
    }

    try {
      const { data: importResult, error: importError } = await supabase.functions.invoke(
        'import-selected-plants',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: { plantas: plantasParaEnviar }, // Payload conforme definido na EF
        }
      );

      if (importError) {
        throw importError;
      }

      if (importResult && importResult.success) {
        toast.success("Importação Concluída", { 
          description: importResult.message || `${importResult.data?.length || 0} plantas processadas.` 
        });
        onPlantsImported(); // Callback para atualizar a lista de plantas na página principal
        setIsOpen(false); // Fechar o dialog
      } else {
        // Caso a EF retorne success: false ou uma estrutura inesperada sem ser um erro HTTP
        throw new Error(importResult?.message || "Falha ao importar plantas. Resposta inesperada da função.");
      }

    } catch (err: any) {
      console.error("Erro ao importar plantas selecionadas:", err);
      toast.error("Falha na Importação", { 
        description: err.message || "Ocorreu um erro ao tentar importar as plantas selecionadas."
      });
    } finally {
      setIsImporting(false);
    }
  };

  const renderContent = () => {
    if (isLoadingIntegrations) {
      return (
        <div className="flex flex-col items-center justify-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="mt-2">Carregando fabricantes configurados...</p>
        </div>
      );
    }

    if (configuredIntegrations.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-40 text-center">
          <AlertCircle className="h-10 w-10 text-yellow-500 mb-3" />
          <p className="font-semibold">Nenhuma Integração Configurada</p>
          <p className="text-sm text-muted-foreground">
            Você precisa configurar e validar credenciais de API para um fabricante em "Configurações {'>'} Integrações" antes de importar plantas.
          </p>
        </div>
      );
    }

    if (importStep === 1 || !selectedFabricanteId) {
      return (
        <div className="space-y-4 py-4">
          <div>
            <label htmlFor="fabricante-select" className="block text-sm font-medium text-gray-700 mb-1">
              Selecione o Fabricante
            </label>
            <Select onValueChange={setSelectedFabricanteId} value={selectedFabricanteId || undefined}>
              <SelectTrigger id="fabricante-select">
                <SelectValue placeholder="Escolha um fabricante..." />
              </SelectTrigger>
              <SelectContent>
                {configuredIntegrations.map(int => (
                  <SelectItem key={int.fabricante_id} value={int.fabricante_id}>
                    {int.fabricante_nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleFetchExternalPlants} disabled={!selectedFabricanteId || isLoadingPlants} className="w-full">
            {isLoadingPlants ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Buscando Plantas...</>
            ) : (
              'Buscar Plantas da API'
            )}
          </Button>
          {errorLoadingPlants && (
            <p className="text-sm text-red-600 text-center mt-2">{errorLoadingPlants}</p>
          )}
        </div>
      );
    }

    // importStep === 2
    if (isLoadingPlants) {
      return (
        <div className="flex flex-col items-center justify-center h-60">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="mt-2">Carregando plantas de {configuredIntegrations.find(f=>f.fabricante_id === selectedFabricanteId)?.fabricante_nome || 'API'}...</p>
        </div>
      );
    }
    
    if (errorLoadingPlants && externalPlantsList.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-60 text-center">
                <XCircle className="h-10 w-10 text-red-500 mb-3" />
                <p className="font-semibold">Erro ao Carregar Plantas</p>
                <p className="text-sm text-muted-foreground">{errorLoadingPlants}</p>
                <Button onClick={() => setImportStep(1)} variant="outline" className="mt-4">Tentar Outro Fabricante</Button>
            </div>
        );
    }

    if (externalPlantsList.length === 0 && !isLoadingPlants) {
        return (
            <div className="flex flex-col items-center justify-center h-60 text-center">
                <AlertCircle className="h-10 w-10 text-yellow-500 mb-3" />
                <p className="font-semibold">Nenhuma Planta Encontrada</p>
                <p className="text-sm text-muted-foreground">Não foram encontradas plantas para o fabricante selecionado.</p>
                <Button onClick={() => setImportStep(1)} variant="outline" className="mt-4">Voltar para Seleção</Button>
            </div>
        );
    }

    return (
      <div className="space-y-4 py-4">
         <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">
                Plantas encontradas para {configuredIntegrations.find(f=>f.fabricante_id === selectedFabricanteId)?.fabricante_nome}:
            </h3>
            <Button onClick={() => setImportStep(1)} variant="outline" size="sm">Trocar Fabricante</Button>
         </div>
        <ScrollArea className="h-[300px] w-full rounded-md border p-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <Checkbox 
                    checked={selectedPlantsArray.length === externalPlantsList.length && externalPlantsList.length > 0}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        const allSelected = externalPlantsList.reduce((acc, plant) => {
                          acc[plant.id_planta_fabricante] = plant;
                          return acc;
                        }, {} as Record<string, PlantaExternaPadronizada>);
                        setSelectedPlantsToImport(allSelected);
                      } else {
                        setSelectedPlantsToImport({});
                      }
                    }}
                    aria-label="Selecionar todas as plantas"
                  />
                </TableHead>
                <TableHead>Nome da Planta (API)</TableHead>
                <TableHead>Potência (kWp)</TableHead>
                <TableHead>Localização (API)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {externalPlantsList.map((plant) => (
                <TableRow key={plant.id_planta_fabricante}>
                  <TableCell>
                    <Checkbox 
                      checked={!!selectedPlantsToImport[plant.id_planta_fabricante]}
                      onCheckedChange={() => handleTogglePlantSelection(plant)}
                      aria-label={`Selecionar planta ${plant.nome_planta_fabricante}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{plant.nome_planta_fabricante}</TableCell>
                  <TableCell>{plant.potencia_instalada_kwp ? plant.potencia_instalada_kwp.toFixed(2) : '-'}</TableCell>
                  <TableCell>{plant.localizacao_string || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
        <p className="text-sm text-muted-foreground">
          Selecionadas para importar: {selectedPlantsArray.length} de {externalPlantsList.length}
        </p>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!isImporting) setIsOpen(open); }}>
      <DialogContent className="sm:max-w-2xl md:max-w-3xl lg:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Importar Plantas Solares de API Externa</DialogTitle>
          <DialogDescription>
            Selecione um fabricante, visualize as plantas disponíveis e importe-as para o ModularOne.
          </DialogDescription>
        </DialogHeader>
        {renderContent()}
        <DialogFooter className="pt-4">
          {importStep === 1 && (
            <>
              <DialogClose asChild>
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={isLoadingPlants || isLoadingIntegrations}>
                  Cancelar
                </Button>
              </DialogClose>
              {/* O botão de buscar plantas já está no renderContent do passo 1 */}
            </>
          )}
          {importStep === 2 && (
            <>
              <Button type="button" variant="outline" onClick={() => setImportStep(1)} disabled={isImporting}>
                Voltar
              </Button>
              <DialogClose asChild>
                <Button type="button" variant="ghost" onClick={() => setIsOpen(false)} disabled={isImporting}>
                  Cancelar Importação
                </Button>
              </DialogClose>
              <Button 
                onClick={handleImportSelectedPlants} 
                disabled={isImporting || selectedPlantsArray.length === 0}
              >
                {isImporting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importando ({selectedPlantsArray.length})...</>
                ) : (
                  `Importar ${selectedPlantsArray.length} Planta(s)`
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 