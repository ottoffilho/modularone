
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Spinner } from '@/components/ui/spinner';

export default function AuthCallback() {
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Get session from URL (this is used in OAuth redirects)
        const { data, error } = await supabase.auth.getSession();
        
        if (error) throw error;
        
        if (data.session) {
          // If we have a session, redirect to dashboard
          navigate('/dashboard');
        } else {
          // If no session, redirect to login
          navigate('/login');
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
  }, [navigate]);

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
