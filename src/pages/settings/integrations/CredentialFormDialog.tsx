import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// Interface para fabricantes (deve alinhar com o que é buscado do DB)
interface FabricanteInfo {
  id: string;
  nome: string;
  api_config_schema: { // Manter a estrutura se for usada para renderizar o formulário
    fields: Array<{
      name: string;
      label: string;
      type: 'text' | 'password';
      required: boolean;
      placeholder?: string;
    }>;
  };
}

// Tipos para o formulário
interface CredentialFormPayload { // Renomeado de FormValues para clareza do que é enviado
  fabricante_id: string;
  credenciais_campos: Record<string, string>; // Alinhado com o payload da EF
  id?: string; // Para atualizações
}

// Schema Zod (mantido simples, validação de credenciais_campos pode ser mais complexa se necessário)
const credentialFormSchema = z.object({
  fabricante_id: z.string().min(1, "Selecione um fabricante."),
  // credenciais aqui refere-se aos campos dinâmicos do formulário
  credenciais: z.record(z.string().min(1, "Este campo é obrigatório.")).optional(),
});

// Ajustar para o tipo de dado que vem da IntegrationsPage (se for uma credencial existente)
// e o que a Edge Function retorna/espera.
// Por agora, mantendo genérico, mas idealmente seria um tipo importado de database.types.ts
// ou um tipo específico para a resposta da EF.
interface ExistingCredentialData {
  id: string;
  fabricante_id: string;
  // credenciais_seguras ou similar não é usado diretamente para popular campos de senha
  // fabricante_nome pode ser útil para a UI, se disponível
  fabricante_nome?: string; 
  // Os campos de credenciais em si não são repopulados (especialmente senhas)
  // A estrutura da EF para GET /credentials retornará os campos necessários.
}

interface CredentialFormDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  existingCredential?: ExistingCredentialData | null; // Renomeado de initialData
  onSaveSuccess: () => void; // Renomeado de onSave e tipo alterado
}

export function CredentialFormDialog({
  isOpen,
  setIsOpen,
  existingCredential, // Renomeado
  onSaveSuccess,    // Renomeado
}: CredentialFormDialogProps) {
  const { session } = useAuth(); // Adicionado
  const [fabricantes, setFabricantes] = useState<FabricanteInfo[]>([]);
  const [isLoadingFabricantes, setIsLoadingFabricantes] = useState(false); // Não iniciar como true se carregado no effect
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof credentialFormSchema>>({ // Usar o tipo inferido do schema
    resolver: zodResolver(credentialFormSchema),
    defaultValues: {
      fabricante_id: existingCredential?.fabricante_id || '',
      credenciais: {}, // Campos de credenciais são dinâmicos, resetados abaixo
    },
  });

  const selectedFabricanteId = form.watch('fabricante_id');

  const selectedFabricanteSchema = useMemo(() => {
    if (!selectedFabricanteId) return null;
    return fabricantes.find(f => f.id === selectedFabricanteId)?.api_config_schema || null;
  }, [selectedFabricanteId, fabricantes]);

  // Carregar fabricantes reais do Supabase
  useEffect(() => {
    async function loadFabricantes() {
      if (!isOpen) return; // Só carrega se o dialog estiver aberto
      setIsLoadingFabricantes(true);
      try {
        const { data, error } = await supabase
          .from('fabricantes_api')
          .select('id, nome, api_config_schema')
          .order('nome');
        
        if (error) throw error;
        setFabricantes(data || []);
      } catch (error: any) {
        console.error("Erro ao buscar fabricantes:", error);
        toast.error("Erro ao Carregar Fabricantes", {
          description: error.message || "Não foi possível carregar a lista de fabricantes.",
        });
        setFabricantes([]);
      } finally {
        setIsLoadingFabricantes(false);
      }
    }
    loadFabricantes();
  }, [isOpen]); // Dependência em isOpen

  useEffect(() => {
    if (isOpen) { // Resetar o formulário quando abrir
      form.reset({
        fabricante_id: existingCredential?.fabricante_id || '',
        credenciais: {}, // Sempre resetar credenciais para forçar re-entrada (especialmente senhas)
      });
    }
  }, [existingCredential, form, isOpen]);

  // Resetar campos de credenciais quando o fabricante mudar e não for edição
  useEffect(() => {
    if (!existingCredential?.id) { // Só reseta se for um novo formulário
      form.setValue('credenciais', {});
    }
  }, [selectedFabricanteId, form, existingCredential]);

  const onSubmit = async (formData: z.infer<typeof credentialFormSchema>) => {
    if (!session?.access_token) {
      toast.error("Erro de Autenticação", { description: "Sessão não encontrada. Faça login novamente." });
      setIsSubmitting(false);
      return;
    }

    // Validar campos de credenciais dinâmicos se necessário
    if (selectedFabricanteSchema) {
      for (const field of selectedFabricanteSchema.fields) {
        if (field.required && !formData.credenciais?.[field.name]) {
          form.setError(`credenciais.${field.name}` as any, { type: "manual", message: "Este campo é obrigatório." });
          toast.error("Erro de Validação", { description: `O campo '${field.label}' é obrigatório.` });
          setIsSubmitting(false);
          return;
        }
      }
    }
    
    setIsSubmitting(true);

    const payload: CredentialFormPayload = {
      fabricante_id: formData.fabricante_id,
      credenciais_campos: formData.credenciais || {}, // Garante que é um objeto
    };

    if (existingCredential?.id) {
      payload.id = existingCredential.id;
    }
    
    try {
      const functionName = existingCredential?.id 
        ? `manage-user-integration-credentials/${existingCredential.id}` 
        : 'manage-user-integration-credentials';

      const method = existingCredential?.id ? 'PUT' : 'POST'; // Usar PUT para editar, POST para criar

      const functionResponse = await supabase.functions.invoke(functionName, {
        method: method, // Método dinâmico
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: payload,
      });

      if (functionResponse.error) {
        throw functionResponse.error;
      }

      toast.success("Sucesso!", { description: `Credenciais para ${fabricantes.find(f=>f.id === formData.fabricante_id)?.nome || 'fabricante'} salvas.` });
      onSaveSuccess();
      setIsOpen(false);
    } catch (error: any) {
      console.error("Erro ao salvar credenciais:", error);
      toast.error("Erro ao Salvar", {
        description: error.message || "Não foi possível salvar as credenciais.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {existingCredential ? 'Editar Integração' : 'Adicionar Nova Integração'}
          </DialogTitle>
          <DialogDescription>
            {existingCredential 
              ? `Editando credenciais para ${fabricantes.find(f => f.id === existingCredential.fabricante_id)?.nome || existingCredential.fabricante_nome || 'fabricante desconhecido'}. As senhas não são exibidas; preencha apenas se desejar alterá-las.`
              : 'Selecione um fabricante e insira suas credenciais de API.'}
          </DialogDescription>
        </DialogHeader>
        
        {isLoadingFabricantes ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2">Carregando fabricantes...</p>
          </div>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
            <div>
              <Label htmlFor="fabricante_id">Fabricante</Label>
              <Controller
                name="fabricante_id"
                control={form.control}
                render={({ field }) => (
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value} 
                    disabled={!!existingCredential} // Desabilitar se estiver editando
                  >
                    <SelectTrigger id="fabricante_id" className="mt-1">
                      <SelectValue placeholder="Selecione um fabricante" />
                    </SelectTrigger>
                    <SelectContent>
                      {fabricantes.map((fab) => (
                        <SelectItem key={fab.id} value={fab.id}>
                          {fab.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.fabricante_id && (
                <p className="text-sm text-red-500 mt-1">{form.formState.errors.fabricante_id.message}</p>
              )}
            </div>

            {selectedFabricanteSchema && selectedFabricanteSchema.fields.map((fieldConfig) => (
              <div key={fieldConfig.name}>
                <Label htmlFor={`credenciais.${fieldConfig.name}`}>{fieldConfig.label}</Label>
                <Controller
                  name={`credenciais.${fieldConfig.name}` as any} // Cast para any devido à natureza dinâmica
                  control={form.control}
                  // Adicionar regras de validação aqui se necessário, ex: required: fieldConfig.required
                  render={({ field }) => (
                    <Input
                      id={`credenciais.${fieldConfig.name}`}
                      type={fieldConfig.type}
                      placeholder={fieldConfig.placeholder || ''}
                      {...field}
                      className="mt-1"
                    />
                  )}
                />
                {/* Validação dinâmica de erro pode ser complexa aqui sem um schema Zod dinâmico completo */}
                {/* Exemplo simples: */}
                {form.formState.errors.credenciais?.[fieldConfig.name] && (
                  // @ts-ignore Acessando dinamicamente, o TS pode reclamar.
                  <p className="text-sm text-red-500 mt-1">{form.formState.errors.credenciais[fieldConfig.name].message}</p>
                )}
              </div>
            ))}
            
            {selectedFabricanteId && !selectedFabricanteSchema && (
                <p className="text-sm text-yellow-600 mt-2">
                    Configuração de API para este fabricante não encontrada ou inválida.
                </p>
            )}

            <DialogFooter className="pt-4">
              <DialogClose asChild>
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>
                  Cancelar
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isSubmitting || !selectedFabricanteSchema || selectedFabricanteSchema.fields.length === 0}>
                {isSubmitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</>
                ) : (
                  'Salvar Credenciais'
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
} 