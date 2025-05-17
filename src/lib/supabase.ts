
import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';

// Check if Supabase environment variables are properly set
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate that we have proper configuration
if (!supabaseUrl || supabaseUrl === 'https://your-project.supabase.co') {
  console.error('⚠️ Supabase URL not properly configured. Please connect your Supabase project.');
}

if (!supabaseAnonKey || supabaseAnonKey === 'your-anon-key') {
  console.error('⚠️ Supabase Anon Key not properly configured. Please connect your Supabase project.');
}

// Create the Supabase client
export const supabase = createClient<Database>(
  supabaseUrl || 'https://your-project.supabase.co',
  supabaseAnonKey || 'your-anon-key'
);

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

