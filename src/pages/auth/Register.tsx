import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { Logo } from '@/components/ui/logo';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { GoogleIcon } from '@/components/ui/icons';
import { verifyDatabaseSchema } from '@/lib/schema-setup';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

const registerSchema = z.object({
  fullName: z.string().min(3, 'Nome completo deve ter pelo menos 3 caracteres'),
  username: z.string().min(3, 'Usuário deve ter pelo menos 3 caracteres'),
  email: z.string().email('E-mail inválido'),
  phone: z.string().min(10, 'Telefone deve ter pelo menos 10 dígitos').optional(),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
  confirmPassword: z.string().min(6, 'A confirmação de senha deve ter pelo menos 6 caracteres')
}).refine(data => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword']
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function Register() {
  const [isLoading, setIsLoading] = useState(false);
  const [schemaError, setSchemaError] = useState(false);
  const navigate = useNavigate();
  const {
    signUp,
    signInWithGoogle
  } = useAuth();

  // Check if the database schema is properly set up
  useEffect(() => {
    const checkSchema = async () => {
      const isValid = await verifyDatabaseSchema();
      setSchemaError(!isValid);
    };
    
    checkSchema();
  }, []);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '',
      username: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: ''
    }
  });

  const onSubmit = async (data: RegisterFormValues) => {
    setIsLoading(true);
    try {
      const {
        error
      } = await signUp(data.email, data.password, {
        full_name: data.fullName,
        username: data.username,
        phone: data.phone
      });
      if (!error) {
        navigate('/login', {
          state: {
            message: 'Cadastro realizado com sucesso. Verifique seu e-mail para confirmar sua conta.'
          }
        });
      } else {
        console.error('Erro de cadastro:', error.message);
      }
    } catch (error) {
      console.error('Erro ao cadastrar:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      await signInWithGoogle();
      // Navigation will be handled by the AuthProvider when session changes
    } catch (error) {
      console.error('Erro ao fazer login com Google:', error);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 bg-gradient-to-b from-primary/5 to-background">
      <div className="w-full max-w-md p-8 bg-card rounded-lg shadow-lg border border-yellow-400/60 shadow-[0_2px_12px_0_rgba(255,215,0,0.08)]">
        {schemaError && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erro de configuração</AlertTitle>
            <AlertDescription>
              O banco de dados não está configurado corretamente. Conecte seu projeto ao Supabase e configure as tabelas necessárias.
            </AlertDescription>
          </Alert>
        )}
        
        <div className="flex flex-col items-center mb-8">
          <Link to="/" className="mb-4">
            <Logo className="h-12 w-12" />
          </Link>
          <h1 className="text-2xl font-bold">Criar Conta</h1>
          <p className="text-muted-foreground mt-2 text-center">
            Preencha os campos abaixo para criar sua conta
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="fullName" render={({
            field
          }) => <FormItem>
                  <FormLabel>Nome Completo</FormLabel>
                  <FormControl>
                    <Input placeholder="Seu nome completo" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>} />
            <FormField control={form.control} name="username" render={({
            field
          }) => <FormItem>
                  <FormLabel>Nome de Usuário</FormLabel>
                  <FormControl>
                    <Input placeholder="seu_usuario" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>} />
            <FormField control={form.control} name="email" render={({
            field
          }) => <FormItem>
                  <FormLabel>E-mail</FormLabel>
                  <FormControl>
                    <Input placeholder="seu@email.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>} />
            <FormField control={form.control} name="phone" render={({
            field
          }) => <FormItem>
                  <FormLabel>Telefone (opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="(00) 00000-0000" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>} />
            <FormField control={form.control} name="password" render={({
            field
          }) => <FormItem>
                  <FormLabel>Senha</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>} />
            <FormField control={form.control} name="confirmPassword" render={({
            field
          }) => <FormItem>
                  <FormLabel>Confirmar Senha</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>} />
            <Button type="submit" className="w-full mt-6" disabled={isLoading || schemaError}>
              {isLoading ? 'Cadastrando...' : 'Cadastrar'}
            </Button>
          </form>
        </Form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">ou continue com</span>
          </div>
        </div>

        <Button type="button" variant="outline" className="w-full" onClick={handleGoogleLogin} disabled={isLoading || schemaError}>
          <GoogleIcon className="mr-2 h-4 w-4" />
          Google
        </Button>

        <p className="text-center mt-6 text-sm text-muted-foreground">
          Já tem uma conta?{' '}
          <Link to="/login" className="text-primary hover:underline">
            Faça login
          </Link>
        </p>
      </div>
    </div>
  );
}
