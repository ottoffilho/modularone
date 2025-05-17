
import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/use-toast';

export default function AuthCallback() {
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  
  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Check if this is an email confirmation callback
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const queryParams = new URLSearchParams(location.search);
        
        const type = hashParams.get('type') || queryParams.get('type');
        
        // Get session from URL (this is used in OAuth redirects and email confirmations)
        const { data, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) throw sessionError;
        
        // If it's an email confirmation, show success message
        if (type === 'signup' || type === 'recovery' || type === 'email_change') {
          toast({
            title: "Email confirmado com sucesso!",
            description: "Sua conta foi verificada.",
          });
        }
        
        if (data.session) {
          // If we have a session, redirect to dashboard
          navigate('/dashboard');
        } else {
          // If no session, redirect to login with a message
          navigate('/login', { 
            state: { 
              message: type === 'signup' ? 'Email confirmado com sucesso! Faça login para continuar.' : undefined 
            } 
          });
        }
      } catch (error) {
        console.error('Erro no callback de autenticação:', error);
        setError('Ocorreu um erro durante a autenticação. Por favor, tente novamente.');
        
        // Redirect to login after showing error
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      }
    };

    handleAuthCallback();
  }, [navigate, location.search, toast]);

  return (
    <div className="min-h-screen flex flex-col justify-center items-center">
      {error ? (
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-500 mb-2">Erro de Autenticação</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <p>Redirecionando para a página de login...</p>
        </div>
      ) : (
        <div className="text-center">
          <Spinner size="lg" className="mb-4" />
          <h2 className="text-xl font-semibold">Autenticando...</h2>
          <p className="text-muted-foreground">Por favor, aguarde enquanto processamos sua autenticação.</p>
        </div>
      )}
    </div>
  );
}
