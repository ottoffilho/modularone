// supabase/functions/_shared/cors.ts

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Permite qualquer origem (para desenvolvimento; pode ser restringido em produção)
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', // Cabeçalhos permitidos
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS', // Métodos HTTP permitidos
}; 