
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
        // Get parameters from both hash and query string
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const queryParams = new URLSearchParams(location.search);
        
        // Check the type parameter from both locations
        const type = hashParams.get('type') || queryParams.get('type');
        console.log('Auth callback type:', type);
        
        // Get session from URL (this is used in OAuth redirects and email confirmations)
        const { data, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Session error:', sessionError);
          throw sessionError;
        }
        
        console.log('Session data:', !!data.session);
        
        if (data.session) {
          // If we have a session, show success message for confirmations
          if (type === 'signup' || type === 'recovery' || type === 'email_change') {
            toast({
              title: "Email confirmado com sucesso!",
              description: "Sua conta foi verificada.",
            });
          }
          
          // Redirect to dashboard with session
          navigate('/dashboard');
        } else {
          // If no session but it was a signup confirmation, redirect with message
          if (type === 'signup') {
            navigate('/login', { 
              state: { 
                message: 'Email confirmado com sucesso! Faça login para continuar.' 
              } 
            });
          } else if (type === 'recovery' || type === 'email_change') {
            // For password recovery or email change
            navigate('/login', { 
              state: { 
                message: 'Verificação concluída. Faça login para continuar.' 
              } 
            });
          } else {
            // Any other case, redirect to login
            navigate('/login');
          }
        }
      } catch (error) {
        console.error('Erro no callback de autenticação:', error);
        setError('Ocorreu um erro durante a autenticação. Por favor, tente novamente.');
        
        // Redirect to login after showing error
        setTimeout(() => {
          navigate('/login', {
            state: {
              error: 'Ocorreu um erro durante a autenticação. Por favor, tente novamente.'
            }
          });
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
