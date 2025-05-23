/**
 * Funções de sanitização para prevenir XSS e outras vulnerabilidades
 */

/**
 * Sanitiza texto simples removendo caracteres perigosos
 * Uma implementação básica que remove HTML/JavaScript básicos
 */
export function sanitizeText(input: string): string {
  if (!input) return '';
  
  // Remove caracteres HTML básicos e scripts
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove < e >
    .replace(/javascript:/gi, '') // Remove javascript:
    .replace(/on\w+=/gi, '') // Remove atributos de evento como onclick=
    .replace(/script/gi, '') // Remove a palavra script
    .replace(/eval\(/gi, '') // Remove eval(
    .replace(/expression\(/gi, ''); // Remove expression(
}

/**
 * Sanitiza objeto recursivamente
 */
export function sanitizeObject<T extends Record<string, any>>(data: T): T {
  const sanitized = { ...data } as any;
  
  for (const [key, value] of Object.entries(sanitized)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeText(value);
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeObject(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => {
        if (typeof item === 'string') return sanitizeText(item);
        if (item && typeof item === 'object') return sanitizeObject(item);
        return item;
      });
    }
  }
  
  return sanitized as T;
}

/**
 * Sanitiza um campo de telefone permitindo apenas números, parênteses, espaços e hífens
 */
export function sanitizePhone(phone: string): string {
  if (!phone) return '';
  return phone.replace(/[^0-9()\s\-+]/g, '');
}

/**
 * Sanitiza um campo de email removendo caracteres perigosos mas mantendo o formato válido
 */
export function sanitizeEmail(email: string): string {
  if (!email) return '';
  return email
    .trim()
    .toLowerCase()
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/script/gi, '');
} 