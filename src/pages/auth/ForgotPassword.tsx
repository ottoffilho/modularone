import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
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
import { ArrowLeft, AlertCircle } from 'lucide-react';

const forgotPasswordSchema = z.object({
  email: z.string().email('E-mail inválido'),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPassword() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { resetPassword } = useAuth();

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (data: ForgotPasswordFormValues) => {
    setIsLoading(true);
    try {
      const { error } = await resetPassword(data.email);
      
      if (!error) {
        setIsSuccess(true);
        form.reset();
      }
    } catch (error) {
      console.error('Erro ao solicitar redefinição de senha:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 bg-gradient-to-b from-primary/5 to-background">
      <div className="w-full max-w-md p-8 bg-card rounded-lg shadow-lg border border-yellow-400/60 shadow-[0_2px_12px_0_rgba(255,215,0,0.08)]">
        <div className="flex flex-col items-center mb-8">
          <Link to="/" className="flex items-center gap-2 mb-2">
            <Logo className="h-8 w-8" />
            <span className="font-bold text-xl">ModularOne</span>
          </Link>
          <h1 className="text-2xl font-bold mt-4">Esqueceu sua senha?</h1>
          <p className="text-muted-foreground mt-2 text-center">
            Digite seu e-mail para receber instruções de redefinição de senha
          </p>
        </div>

        {isSuccess ? (
          <div className="space-y-6">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Enviamos um e-mail com instruções para redefinir sua senha. Verifique sua caixa de entrada.
              </AlertDescription>
            </Alert>
            <Button asChild variant="ghost" className="w-full">
              <Link to="/login" className="flex items-center justify-center gap-2">
                <ArrowLeft size={16} />
                Voltar para o login
              </Link>
            </Button>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
                    <FormControl>
                      <Input placeholder="seu@email.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Enviando...' : 'Enviar instruções'}
              </Button>
              <Button asChild variant="ghost" className="w-full">
                <Link to="/login" className="flex items-center justify-center gap-2">
                  <ArrowLeft size={16} />
                  Voltar para o login
                </Link>
              </Button>
            </form>
          </Form>
        )}
      </div>
    </div>
  );
}
