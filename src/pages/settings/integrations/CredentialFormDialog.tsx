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

// Mocked interfaces (ajustar conforme database.types.ts)
interface MockedFabricante {
  id: string;
  nome: string;
  api_config_schema: {
    fields: Array<{
      name: string;
      label: string;
      type: 'text' | 'password';
      required: boolean;
      placeholder?: string;
    }>;
  };
}

interface FormValues {
  fabricante_id: string;
  credenciais: Record<string, string>;
}

// Schema Zod simplificado (refinar depois)
const credentialFormSchema = z.object({
  fabricante_id: z.string().min(1, "Selecione um fabricante."),
  // credenciais será validado dinamicamente ou em uma etapa posterior
  credenciais: z.record(z.string()).optional(), // Permitindo que seja opcional ou um record de strings
});

interface CredentialFormDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  initialData?: any | null; //  (ex: { id: string; fabricante_id: string; credenciais_seguras: Record<string, string> })
  onSave: (data: FormValues) => void;
}

export function CredentialFormDialog({
  isOpen,
  setIsOpen,
  initialData,
  onSave,
}: CredentialFormDialogProps) {
  const [fabricantes, setFabricantes] = useState<MockedFabricante[]>([]);
  const [isLoadingFabricantes, setIsLoadingFabricantes] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(credentialFormSchema),
    defaultValues: {
      fabricante_id: initialData?.fabricante_id || '',
      credenciais: initialData?.credenciais_seguras || {},
    },
  });

  const selectedFabricanteId = form.watch('fabricante_id');

  const selectedFabricanteSchema = useMemo(() => {
    if (!selectedFabricanteId) return null;
    return fabricantes.find(f => f.id === selectedFabricanteId)?.api_config_schema || null;
  }, [selectedFabricanteId, fabricantes]);

  // Mocked data loading para fabricantes
  useEffect(() => {
    setIsLoadingFabricantes(true);
    const timer = setTimeout(() => {
      setFabricantes([
        {
          id: 'growatt_mock_id',
          nome: 'Growatt (Mock)',
          api_config_schema: {
            fields: [
              { name: 'username', label: 'Usuário API Growatt', type: 'text', required: true, placeholder: 'Seu usuário Growatt' },
              { name: 'password', label: 'Senha API Growatt', type: 'password', required: true, placeholder: 'Sua senha Growatt' },
            ],
          },
        },
        {
          id: 'saj_mock_id',
          nome: 'SAJ (Mock)',
          api_config_schema: {
            fields: [
              { name: 'api_key', label: 'SAJ API Key', type: 'password', required: true, placeholder: 'Sua chave de API SAJ' },
            ],
          },
        },
        {
          id: 'goodwe_mock_id',
          nome: 'GoodWe (Mock)',
          api_config_schema: {
            fields: [
              { name: 'account', label: 'GoodWe Account ID', type: 'text', required: true },
              { name: 'key', label: 'GoodWe API Key', type: 'password', required: true },
            ],
          },
        },
      ]);
      setIsLoadingFabricantes(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (initialData) {
      form.reset({
        fabricante_id: initialData.fabricante_id || '',
        // Não repopular senhas. Campos de credenciais serão reconstruídos pelo schema.
        // Se initialData.credenciais_seguras existir, poderia ser usado para preencher campos não-senha
        // mas a renderização dinâmica cuidará dos campos em si.
        credenciais: {},
      });
    } else {
      form.reset({ fabricante_id: '', credenciais: {} });
    }
  }, [initialData, form, isOpen]); // Adicionado isOpen para resetar ao abrir

  // Resetar campos de credenciais quando o fabricante mudar
  useEffect(() => {
    form.setValue('credenciais', {});
  }, [selectedFabricanteId, form]);

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    console.log('Form data submitted:', data);
    // Simular chamada de API
    await new Promise(resolve => setTimeout(resolve, 1000));
    onSave(data); // Chamar o callback onSave passado pela IntegrationsPage
    setIsSubmitting(false);
    setIsOpen(false); // Fechar o diálogo após salvar
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {initialData ? 'Editar Integração' : 'Adicionar Nova Integração'}
          </DialogTitle>
          <DialogDescription>
            {initialData 
              ? `Editando credenciais para ${fabricantes.find(f => f.id === initialData.fabricante_id)?.nome || 'fabricante desconhecido'}.`
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
                    disabled={!!initialData} // Desabilitar se estiver editando
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
                {/* Exemplo simples: 
                {form.formState.errors.credenciais?.[fieldConfig.name] && (
                  <p className="text-sm text-red-500 mt-1">{form.formState.errors.credenciais[fieldConfig.name].message}</p>
                )} 
                */}
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