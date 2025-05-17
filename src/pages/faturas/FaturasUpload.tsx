import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { ArrowLeft, Upload, File, Check, X, AlertCircle } from 'lucide-react';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';

interface UC {
  id: string;
  identificador: string;
  endereco?: string;
  cliente_nome?: string;
}

// Schema for validating fatura data
const faturaSchema = z.object({
  unidade_consumidora_id: z.string({ required_error: 'Selecione uma unidade consumidora' }),
  mes_referencia: z.string({ required_error: 'Mês de referência é obrigatório' }),
  arquivo: z.instanceof(FileList).refine(files => files.length === 1, {
    message: 'Arquivo é obrigatório',
  }),
});

type FaturaFormValues = z.infer<typeof faturaSchema>;

export default function FaturasUpload() {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const ucIdFromQuery = queryParams.get('uc');

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [ucs, setUcs] = useState<UC[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadedFile, setUploadedFile] = useState<{
    name: string;
    url: string;
  } | null>(null);
  
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const form = useForm<FaturaFormValues>({
    resolver: zodResolver(faturaSchema),
    defaultValues: {
      unidade_consumidora_id: ucIdFromQuery || '',
      mes_referencia: '',
      arquivo: undefined,
    },
  });

  // Watch the file input to show the selected file
  const selectedFile = form.watch('arquivo');
  const fileName = selectedFile?.[0]?.name;
  const fileSize = selectedFile?.[0]?.size;

  // Format file size for display
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Load UCs list
  useEffect(() => {
    const loadUCs = async () => {
      if (!user) return;
      
      try {
        setInitialLoading(true);
        
        // Load UCs with client info
        const { data, error } = await supabase
          .from('unidades_consumidoras')
          .select(`
            id,
            identificador,
            endereco,
            clientes:cliente_id (nome_razao_social)
          `)
          .eq('user_id', user.id)
          .order('identificador');
          
        if (error) throw error;
        
        // Format data for select options
        const formattedUCs = data.map((uc: any) => ({
          id: uc.id,
          identificador: uc.identificador,
          endereco: uc.endereco,
          cliente_nome: uc.clientes?.nome_razao_social || null
        }));
        
        setUcs(formattedUCs || []);
      } catch (error) {
        console.error('Erro ao carregar unidades consumidoras:', error);
        toast({
          title: 'Erro',
          description: 'Não foi possível carregar a lista de unidades consumidoras.',
          variant: 'destructive',
        });
      } finally {
        setInitialLoading(false);
      }
    };
    
    loadUCs();
  }, [user]);

  const onSubmit = async (values: FaturaFormValues) => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      const file = values.arquivo[0];
      if (!file) {
        throw new Error('Nenhum arquivo selecionado');
      }
      
      // Generate a unique file name
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
      const filePath = `${user.id}/faturas/${fileName}`;
      
      // Track upload progress with a separate listener
      let uploadProgress = 0;
      
      // Upload file to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('faturas')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });
        
      if (uploadError) throw uploadError;
      
      // Get public URL for the uploaded file
      const { data: publicUrlData } = supabase.storage
        .from('faturas')
        .getPublicUrl(filePath);
        
      const publicUrl = publicUrlData.publicUrl;
      
      // Save fatura record in database
      const { error: insertError } = await supabase
        .from('faturas')
        .insert({
          mes_referencia: values.mes_referencia,
          arquivo_url: publicUrl,
          nome_arquivo: file.name,
          unidade_consumidora_id: values.unidade_consumidora_id,
          user_id: user.id,
          created_at: new Date().toISOString(),
        });
        
      if (insertError) throw insertError;
      
      // Set uploaded file info for success message
      setUploadedFile({
        name: file.name,
        url: publicUrl
      });
      
      toast({
        title: 'Fatura enviada com sucesso',
        description: `O arquivo ${file.name} foi enviado e registrado.`,
      });
      
      // Reset the form
      form.reset();
      setUploadProgress(null);
      
    } catch (error) {
      console.error('Erro ao enviar fatura:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Não foi possível enviar a fatura.',
        variant: 'destructive',
      });
      setUploadProgress(null);
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Button
          variant="ghost"
          className="mb-2"
          onClick={() => navigate('/dashboard')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">
          Upload de Faturas
        </h1>
        <p className="text-muted-foreground mt-2">
          Envie as faturas de energia para análise e gestão.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Enviar Nova Fatura</CardTitle>
            <CardDescription>
              Selecione a unidade consumidora, o mês de referência e faça o upload da fatura.
            </CardDescription>
          </CardHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="unidade_consumidora_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unidade Consumidora *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione uma unidade consumidora" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ucs.length === 0 ? (
                            <SelectItem value="" disabled>
                              Nenhuma UC cadastrada
                            </SelectItem>
                          ) : (
                            ucs.map((uc) => (
                              <SelectItem key={uc.id} value={uc.id}>
                                {uc.identificador}
                                {uc.cliente_nome && ` - ${uc.cliente_nome}`}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="mes_referencia"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mês de Referência *</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="month"
                          placeholder="MM/AAAA"
                          className="w-full"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="arquivo"
                  render={({ field: { ref, name, onBlur, onChange } }) => (
                    <FormItem>
                      <FormLabel>Arquivo da Fatura *</FormLabel>
                      <FormControl>
                        <div className="grid w-full items-center gap-1.5">
                          <Input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            ref={ref}
                            name={name}
                            onBlur={onBlur}
                            onChange={(e) => {
                              onChange(e.target.files);
                              setUploadProgress(null);
                              setUploadedFile(null);
                            }}
                            className="sr-only"
                            id="fatura-file"
                          />
                          <label
                            htmlFor="fatura-file"
                            className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-input rounded-lg cursor-pointer bg-background hover:bg-accent/10 transition-colors"
                          >
                            {fileName ? (
                              <div className="flex flex-col items-center space-y-2 p-4">
                                <File className="w-8 h-8 text-primary" />
                                <div className="text-sm font-medium text-center">
                                  {fileName}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {fileSize && formatFileSize(fileSize)}
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center space-y-2">
                                <Upload className="w-8 h-8 text-muted-foreground" />
                                <div className="text-sm font-medium">
                                  Clique para selecionar um arquivo
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  PDF, JPG ou PNG (max. 10MB)
                                </div>
                              </div>
                            )}
                          </label>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {uploadProgress !== null && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Upload em progresso...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} className="h-2" />
                  </div>
                )}
              </CardContent>
              <CardFooter>
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={loading || ucs.length === 0}
                >
                  {loading ? (
                    <>
                      <Spinner size="sm" className="mr-2" /> 
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Enviar Fatura
                    </>
                  )}
                </Button>
              </CardFooter>
            </form>
          </Form>
        </Card>

        {/* Success or Instructions Card */}
        <Card>
          <CardHeader>
            <CardTitle>
              {uploadedFile 
                ? "Fatura Enviada com Sucesso" 
                : "Instruções"
              }
            </CardTitle>
          </CardHeader>
          <CardContent>
            {uploadedFile ? (
              <div className="flex flex-col items-center py-6 text-center">
                <div className="rounded-full bg-green-100 dark:bg-green-900 p-3 mb-4">
                  <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-lg font-medium mb-2">Fatura enviada com sucesso!</h3>
                <p className="text-muted-foreground mb-4">
                  O arquivo <span className="font-medium">{uploadedFile.name}</span> foi enviado e registrado.
                </p>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    asChild
                  >
                    <a 
                      href={uploadedFile.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      Visualizar Arquivo
                    </a>
                  </Button>
                  <Button 
                    type="button" 
                    size="sm"
                    onClick={() => {
                      setUploadedFile(null);
                      form.reset();
                    }}
                  >
                    Enviar outra fatura
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start gap-2">
                  <div className="bg-primary/10 p-1 rounded-full mt-0.5">
                    <Check className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Formatos aceitos</p>
                    <p className="text-xs text-muted-foreground">PDF, JPG e PNG (tamanho máximo de 10MB)</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-2">
                  <div className="bg-primary/10 p-1 rounded-full mt-0.5">
                    <Check className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Mês de Referência</p>
                    <p className="text-xs text-muted-foreground">O mês e ano de referência da fatura (não a data de vencimento)</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-2">
                  <div className="bg-destructive/10 p-1 rounded-full mt-0.5">
                    <X className="h-4 w-4 text-destructive" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Evite arquivos corrompidos</p>
                    <p className="text-xs text-muted-foreground">Certifique-se de que o arquivo está íntegro e legível</p>
                  </div>
                </div>
                
                {ucs.length === 0 && (
                  <Card className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800 p-4 mt-4">
                    <div className="flex items-start gap-2">
                      <div className="text-amber-600 dark:text-amber-400 mt-0.5">
                        <AlertCircle className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-medium text-amber-800 dark:text-amber-300">Nenhuma UC cadastrada</h4>
                        <p className="text-sm text-amber-700 dark:text-amber-400">
                          Você precisa cadastrar uma unidade consumidora antes de enviar faturas.
                        </p>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="mt-2 bg-amber-100 hover:bg-amber-200 dark:bg-amber-900 dark:hover:bg-amber-800 border-amber-200 dark:border-amber-800"
                          asChild
                        >
                          <Link to="/ucs/novo">
                            Cadastrar UC
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </Card>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
