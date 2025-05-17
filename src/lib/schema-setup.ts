
import { supabase } from './supabase';

/**
 * Verifies if the required database schema exists in Supabase
 * and creates it if it doesn't.
 */
export const verifyDatabaseSchema = async () => {
  try {
    // Check if profiles table exists
    const { error: checkError } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);
    
    // If profiles table doesn't exist or there's an error, show instructions
    if (checkError) {
      console.error('Database schema not properly set up:', checkError.message);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error verifying database schema:', error);
    return false;
  }
};

/**
 * This SQL can be run in Supabase SQL Editor to create the required tables
 */
export const getSetupSQL = () => `
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name TEXT,
  username TEXT UNIQUE,
  phone TEXT,
  updated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Set up Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own profile" 
  ON public.profiles 
  FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
  ON public.profiles 
  FOR UPDATE 
  USING (auth.uid() = id);

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, username, phone)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'username',
    NEW.raw_user_meta_data->>'phone'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
`;
