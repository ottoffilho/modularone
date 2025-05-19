import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Logo } from '@/components/ui/logo';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

const resetPasswordSchema = z.object({
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
  confirmPassword: z.string().min(6, 'A confirmação de senha deve ter pelo menos 6 caracteres'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export default function ResetPassword() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const { updatePassword } = useAuth();
  const navigate = useNavigate();

  // Check if the user has a valid session from the password reset link
  useEffect(() => {
    const checkSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      
      if (error || !data.session) {
        setIsError(true);
        setErrorMessage('Link de redefinição de senha inválido ou expirado. Por favor, solicite um novo link.');
      }
    };
    
    checkSession();
  }, []);

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: ResetPasswordFormValues) => {
    setIsLoading(true);
    try {
      const { error } = await updatePassword(data.password);
      
      if (!error) {
        setIsSuccess(true);
        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      } else {
        setIsError(true);
        setErrorMessage(error.message || 'Erro ao redefinir senha.');
      }
    } catch (error) {
      console.error('Erro ao redefinir senha:', error);
      setIsError(true);
      setErrorMessage('Ocorreu um erro ao redefinir sua senha. Por favor, tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 bg-gradient-to-b from-primary/5 to-background">
      <div className="w-full max-w-md p-8 bg-card rounded-lg shadow-lg border border-yellow-400/60 shadow-[0_2px_12px_0_rgba(255,215,0,0.08)]">
        <div className="flex flex-col items-center mb-8">
          <Link to="/" className="mb-4">
            <Logo className="h-12 w-12" />
          </Link>
          <h1 className="text-2xl font-bold">Redefinir Senha</h1>
          <p className="text-muted-foreground mt-2 text-center">
            Digite sua nova senha abaixo
          </p>
        </div>

        {isSuccess ? (
          <Alert className="bg-green-50 text-green-800 border-green-200">
            <AlertCircle className="h-4 w-4 text-green-500" />
            <AlertDescription className="text-green-700">
              Senha redefinida com sucesso! Você será redirecionado para a página de login.
            </AlertDescription>
          </Alert>
        ) : isError ? (
          <div className="space-y-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
            <Button asChild className="w-full">
              <Link to="/forgot-password">
                Solicitar novo link
              </Link>
            </Button>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nova Senha</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmar Senha</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Redefinindo...' : 'Redefinir Senha'}
              </Button>
            </form>
          </Form>
        )}
      </div>
    </div>
  );
}
