import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useToast } from "@/hooks/use-toast";

// Constantes para controle de tentativas de login
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutos em milissegundos

export interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, metadata?: {
    full_name?: string;
    phone?: string;
    username?: string;
  }) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<{ error: Error | null }>;
}

// Função de validação de senha forte
function isStrongPassword(password: string): boolean {
  // Pelo menos 8 caracteres
  if (password.length < 8) return false;
  
  // Verificar complexidade
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /[0-9]/.test(password);
  const hasSymbols = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  
  return hasUpperCase && hasLowerCase && hasNumbers && hasSymbols;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginAttempts, setLoginAttempts] = useState<number>(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Initial session check
    const getInitialSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        setSession(data.session);
        setUser(data.session?.user ?? null);
      } catch (error) {
        console.error('Error getting initial session:', error);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // Verificar se há um lockout salvo e ainda válido
    const savedLockout = localStorage.getItem('auth_lockout');
    if (savedLockout) {
      const lockoutTime = parseInt(savedLockout, 10);
      if (lockoutTime > Date.now()) {
        setLockoutUntil(lockoutTime);
      } else {
        localStorage.removeItem('auth_lockout');
      }
    }

    // Recuperar tentativas salvas
    const savedAttempts = localStorage.getItem('auth_attempts');
    if (savedAttempts) {
      setLoginAttempts(parseInt(savedAttempts, 10));
    }

    // Subscribe to auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        // Handle specific auth events
        if (event === 'SIGNED_IN') {
          // Reset do contador de tentativas em caso de sucesso
          setLoginAttempts(0);
          localStorage.removeItem('auth_attempts');
          localStorage.removeItem('auth_lockout');
          setLockoutUntil(null);
          
          toast({
            title: "Login bem-sucedido!",
            description: "Você está agora conectado ao ModularOne.",
          });
        } else if (event === 'SIGNED_OUT') {
          toast({
            title: "Desconectado",
            description: "Você saiu da sua conta com sucesso.",
          });
        } else if (event === 'USER_UPDATED') {
          toast({
            title: "Perfil atualizado",
            description: "Suas informações foram atualizadas com sucesso.",
          });
        } else if (event === 'PASSWORD_RECOVERY') {
          toast({
            title: "Redefinição de senha",
            description: "Siga as instruções para redefinir sua senha.",
          });
        }
      }
    );

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [toast]);

  // Auth methods
  const handleSignIn = async (email: string, password: string) => {
    try {
      // Verificar lockout
      if (lockoutUntil && Date.now() < lockoutUntil) {
        const minutesLeft = Math.ceil((lockoutUntil - Date.now()) / 60000);
        throw new Error(`Muitas tentativas de login. Tente novamente em ${minutesLeft} minutos.`);
      }
      
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      
      return { error: null };
    } catch (error) {
      // Incrementar contador de tentativas
      const newAttempts = loginAttempts + 1;
      setLoginAttempts(newAttempts);
      localStorage.setItem('auth_attempts', newAttempts.toString());
      
      // Verificar se atingiu o limite
      if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
        const lockoutTime = Date.now() + LOCKOUT_TIME;
        setLockoutUntil(lockoutTime);
        localStorage.setItem('auth_lockout', lockoutTime.toString());
        
        toast({
          title: "Conta temporariamente bloqueada",
          description: "Muitas tentativas de login. Tente novamente em 15 minutos.",
          variant: "destructive",
        });
        
        return { error: new Error("Conta temporariamente bloqueada. Tente novamente em 15 minutos.") };
      }
      
      toast({
        title: "Erro no login",
        description: error instanceof Error ? error.message : "Um erro ocorreu durante o login",
        variant: "destructive",
      });
      return { error: error as Error };
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (email: string, password: string, metadata?: { 
    full_name?: string; 
    phone?: string;
    username?: string;
  }) => {
    try {
      setLoading(true);
      
      // Validar força da senha
      if (!isStrongPassword(password)) {
        throw new Error("A senha deve ter pelo menos 8 caracteres e incluir letras maiúsculas, minúsculas, números e símbolos.");
      }
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata,
        }
      });

      if (error) throw error;
      
      toast({
        title: "Cadastro realizado!",
        description: "Verifique seu e-mail para confirmar sua conta.",
      });
      
      return { error: null };
    } catch (error) {
      toast({
        title: "Erro no cadastro",
        description: error instanceof Error ? error.message : "Ocorreu um erro durante o cadastro",
        variant: "destructive",
      });
      return { error: error as Error };
    } finally {
      setLoading(false);
    }
  };

  const handleSignInWithGoogle = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        }
      });

      if (error) throw error;
      return { error: null };
    } catch (error) {
      toast({
        title: "Erro no login com Google",
        description: error instanceof Error ? error.message : "Ocorreu um erro durante a autenticação",
        variant: "destructive",
      });
      return { error: error as Error };
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (email: string) => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;
      
      toast({
        title: "E-mail enviado",
        description: "Instruções para redefinição de senha foram enviadas para o seu e-mail.",
      });
      
      return { error: null };
    } catch (error) {
      toast({
        title: "Erro na solicitação",
        description: error instanceof Error ? error.message : "Ocorreu um erro ao solicitar a redefinição de senha",
        variant: "destructive",
      });
      return { error: error as Error };
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (password: string) => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) throw error;
      
      toast({
        title: "Senha atualizada",
        description: "Sua senha foi atualizada com sucesso.",
      });
      
      return { error: null };
    } catch (error) {
      toast({
        title: "Erro na atualização",
        description: error instanceof Error ? error.message : "Ocorreu um erro ao atualizar sua senha",
        variant: "destructive",
      });
      return { error: error as Error };
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      toast({
        title: "Desconectado",
        description: "Você saiu da sua conta com sucesso.",
      });
      
      return { error: null };
    } catch (error) {
      toast({
        title: "Erro ao sair",
        description: error instanceof Error ? error.message : "Ocorreu um erro ao sair da sua conta",
        variant: "destructive",
      });
      return { error: error as Error };
    } finally {
      setLoading(false);
    }
  };

  const value = {
    session,
    user,
    loading,
    signIn: handleSignIn,
    signUp: handleSignUp,
    signInWithGoogle: handleSignInWithGoogle,
    resetPassword: handleResetPassword,
    updatePassword: handleUpdatePassword,
    signOut: handleSignOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
