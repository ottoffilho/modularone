import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';

// Use the values from environment variables instead of hardcoded values
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Variáveis de ambiente Supabase não configuradas.");
}

// Create the Supabase client
export const supabase = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey
);

// Funções de proteção CSRF
export const generateCsrfToken = (): string => {
  return crypto.randomUUID();
}

// Armazenar o token na sessão
export const storeCsrfToken = (token: string): void => {
  sessionStorage.setItem('csrf_token', token);
}

// Obter o token armazenado
export const getCsrfToken = (): string | null => {
  return sessionStorage.getItem('csrf_token');
}

// Utility functions for authentication
export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  return { data, error };
};

export const signUp = async (email: string, password: string, metadata?: { full_name?: string, phone?: string, username?: string }) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
    },
  });
  
  return { data, error };
};

export const signInWithGoogle = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  
  return { data, error };
};

export const resetPassword = async (email: string) => {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  
  return { data, error };
};

export const updatePassword = async (newPassword: string) => {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  });
  
  return { data, error };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

export const getCurrentUser = async () => {
  const { data, error } = await supabase.auth.getUser();
  return { user: data.user, error };
};
