// supabase/functions/_shared/cors.ts

/**
 * Headers CORS restritivos para serem usados em todas as funções Edge
 * Valida as origens permitidas para maior segurança
 */
export const corsHeaders = (req: Request) => {
  const allowedOrigins = [
    'https://modularone.com',
    'https://app.modularone.com',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5174'
  ];
  
  const origin = req.headers.get('Origin') || '';
  const isAllowedOrigin = allowedOrigins.includes(origin);
  
  return {
    'Access-Control-Allow-Origin': isAllowedOrigin ? origin : '',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
};

// Manter a versão antiga para compatibilidade temporária
export const corsHeadersLegacy = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info",
  "Access-Control-Max-Age": "86400",
}; 