/**
 * Funções de validação específicas para o Brasil
 */

/**
 * Valida formato de CEP brasileiro
 */
export function isValidCEP(cep: string): boolean {
  if (!cep) return false;
  const cepRegex = /^[0-9]{5}-?[0-9]{3}$/;
  return cepRegex.test(cep);
}

/**
 * Valida CPF brasileiro com dígitos verificadores
 */
export function isValidCPF(cpf: string): boolean {
  if (!cpf) return false;
  
  cpf = cpf.replace(/[^\d]/g, '');
  
  if (cpf.length !== 11) return false;
  
  // Verificar se todos os dígitos são iguais
  if (/^(\d)\1+$/.test(cpf)) return false;
  
  // Validar primeiro dígito verificador
  let soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += parseInt(cpf.charAt(i)) * (10 - i);
  }
  let resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  if (resto !== parseInt(cpf.charAt(9))) return false;
  
  // Validar segundo dígito verificador
  soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += parseInt(cpf.charAt(i)) * (11 - i);
  }
  resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  if (resto !== parseInt(cpf.charAt(10))) return false;
  
  return true;
}

/**
 * Valida CNPJ brasileiro com dígitos verificadores
 */
export function isValidCNPJ(cnpj: string): boolean {
  if (!cnpj) return false;
  
  cnpj = cnpj.replace(/[^\d]/g, '');
  
  if (cnpj.length !== 14) return false;
  
  // Verificar se todos os dígitos são iguais
  if (/^(\d)\1+$/.test(cnpj)) return false;
  
  // Cálculo dos dígitos verificadores
  let tamanho = cnpj.length - 2;
  let numeros = cnpj.substring(0, tamanho);
  const digitos = cnpj.substring(tamanho);
  let soma = 0;
  let pos = tamanho - 7;
  
  // Primeiro dígito
  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  
  let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== parseInt(digitos.charAt(0))) return false;
  
  // Segundo dígito
  tamanho = tamanho + 1;
  numeros = cnpj.substring(0, tamanho);
  soma = 0;
  pos = tamanho - 7;
  
  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  
  resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  
  return resultado === parseInt(digitos.charAt(1));
}

/**
 * Valida CPF ou CNPJ baseado no tamanho
 */
export function isValidCpfCnpj(document: string): boolean {
  if (!document) return false;
  
  const cleanDocument = document.replace(/[^\d]/g, '');
  
  if (cleanDocument.length === 11) {
    return isValidCPF(cleanDocument);
  } else if (cleanDocument.length === 14) {
    return isValidCNPJ(cleanDocument);
  }
  
  return false;
}

/**
 * Valida formato de telefone brasileiro
 */
export function isValidPhone(phone: string): boolean {
  if (!phone) return false;
  
  const phoneRegex = /^(?:\+55\s?)?(?:\(?\d{2}\)?\s?)(?:9?\d{4}[-\s]?\d{4})$/;
  return phoneRegex.test(phone);
}

/**
 * Valida formato de email
 */
export function isValidEmail(email: string): boolean {
  if (!email) return false;
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
} 