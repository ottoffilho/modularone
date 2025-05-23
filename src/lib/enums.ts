/**
 * Enumerações (Enums) utilizados no sistema
 * 
 * Todas as enumerações devem ser sincronizadas com as definições no banco de dados (Supabase).
 */

/**
 * Tipos de clientes
 */
export enum TipoCliente {
  PROPRIETARIO_USINA = 'PROPRIETARIO_USINA',
  CONSUMIDOR_BENEFICIARIO = 'CONSUMIDOR_BENEFICIARIO',
  EMPRESA_PARCEIRA = 'EMPRESA_PARCEIRA',
  OUTRO = 'OUTRO'
}

/**
 * Tipos de pessoa
 */
export enum TipoPessoa {
  PF = 'PF',
  PJ = 'PJ'
}

/**
 * Perfis de Unidade Consumidora
 */
export enum PerfilUC {
  GERADORA_PRINCIPAL = 'GERADORA_PRINCIPAL',
  CONSUMIDORA_BENEFICIARIA = 'CONSUMIDORA_BENEFICIARIA',
  CONSUMIDORA_SIMPLES = 'CONSUMIDORA_SIMPLES'
}

/**
 * Status da Unidade Consumidora
 */
export enum StatusUC {
  ATIVA = 'ATIVA',
  INATIVA = 'INATIVA',
  PENDENTE = 'PENDENTE'
}

/**
 * Status da Planta Solar
 */
export enum StatusPlantaSolar {
  ATIVA = 'ATIVA',
  INATIVA = 'INATIVA',
  MANUTENCAO = 'MANUTENCAO',
  PLANEJAMENTO = 'PLANEJAMENTO'
}

/**
 * Tipos de Sistema de Planta Solar
 */
export enum TipoSistemaPlantaSolar {
  ON_GRID = 'ON_GRID',
  OFF_GRID = 'OFF_GRID',
  HIBRIDO = 'HIBRIDO'
}

/**
 * Fontes de dados de Geração
 */
export enum FonteDadosGeracao {
  MANUAL = 'MANUAL',
  API_GROWATT = 'API_GROWATT',
  API_SAJ = 'API_SAJ'
}

/**
 * Fabricantes de Inversores
 * IMPORTANTE: Este enum deve ser sincronizado com o enum public.fabricante_enum no banco de dados
 */
export enum FabricanteInversor {
  GROWATT = 'GROWATT',
  SAJ = 'SAJ',
  FRONIUS = 'FRONIUS',
  SUNGROW = 'SUNGROW',
  HUAWEI = 'HUAWEI',
  GOODWE = 'GOODWE',
  OUTRO = 'OUTRO'
}

/**
 * Status de Validação de Credenciais
 */
export enum StatusValidacaoCredencial {
  PENDENTE = 'PENDENTE',
  VALIDO = 'VALIDO',
  INVALIDO = 'INVALIDO'
} 