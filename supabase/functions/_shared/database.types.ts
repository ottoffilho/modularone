// supabase/functions/_shared/database.types.ts
// This is a placeholder. Replace with your actual Supabase generated types.

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      // Exemplo: Adicionar suas tabelas aqui
      fabricantes_equipamentos: {
        Row: {
          id: string; // uuid
          nome: string | null;
          identificador_api: string | null;
          api_config_schema: Json | null; 
          // ... outros campos
        };
        Insert: {
          id?: string;
          nome?: string | null;
          // ...
        };
        Update: {
          id?: string;
          nome?: string | null;
          // ...
        };
      };
      credenciais_servico_usuario: {
        Row: {
          id: string; // uuid
          user_id: string; // uuid
          fabricante_id: string; // uuid
          credenciais_seguras: Json | null; // Idealmente, este seria um tipo mais específico se o JSONB tem uma estrutura conhecida
          status_validacao: string | null;
          // ... outros campos
        };
        Insert: { /* ... */ };
        Update: { /* ... */ };
      };
      // Adicionar outras tabelas usadas pelas suas funções aqui
    };
    Views: { /* ... */ };
    Functions: { /* ... */ };
  };
  // Adicionar outros schemas se houver (ex: storage)
} 