
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string | null
          username: string | null
          phone: string | null
          updated_at: string | null
          created_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          username?: string | null
          phone?: string | null
          updated_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          username?: string | null
          phone?: string | null
          updated_at?: string | null
          created_at?: string
        }
      }
      clientes: {
        Row: {
          id: string
          nome_razao_social: string
          cpf_cnpj: string
          contato: string | null
          user_id: string
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          nome_razao_social: string
          cpf_cnpj: string
          contato?: string | null
          user_id: string
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          nome_razao_social?: string
          cpf_cnpj?: string
          contato?: string | null
          user_id?: string
          created_at?: string
          updated_at?: string | null
        }
      }
      unidades_consumidoras: {
        Row: {
          id: string
          identificador: string
          endereco: string
          distribuidora: string
          cliente_id: string | null
          user_id: string
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          identificador: string
          endereco: string
          distribuidora: string
          cliente_id?: string | null
          user_id: string
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          identificador?: string
          endereco?: string
          distribuidora?: string
          cliente_id?: string | null
          user_id?: string
          created_at?: string
          updated_at?: string | null
        }
      }
      faturas: {
        Row: {
          id: string
          mes_referencia: string
          arquivo_url: string
          nome_arquivo: string
          unidade_consumidora_id: string
          user_id: string
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          mes_referencia: string
          arquivo_url: string
          nome_arquivo: string
          unidade_consumidora_id: string
          user_id: string
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          mes_referencia?: string
          arquivo_url?: string
          nome_arquivo?: string
          unidade_consumidora_id?: string
          user_id?: string
          created_at?: string
          updated_at?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
