export function hexToUint8Array(hexString: string): Uint8Array {
  if (hexString.length % 2 !== 0) {
    throw new Error("Invalid hexString length");
  }
  const byteArray = new Uint8Array(hexString.length / 2);
  for (let i = 0; i < hexString.length; i += 2) {
    byteArray[i / 2] = parseInt(hexString.substring(i, i + 2), 16);
    if (isNaN(byteArray[i/2])) throw new Error("Invalid hex character in hexString");
  }
  return byteArray;
}

export function uint8ArrayToHex(buffer: Uint8Array): string {
  return Array.from(buffer)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function getCryptoKey(): Promise<CryptoKey> {
  const encryptionKeyString = Deno.env.get("CREDENTIALS_ENCRYPTION_KEY");
  if (!encryptionKeyString) {
    console.error("CRITICAL: CREDENTIALS_ENCRYPTION_KEY não está configurada.");
    throw new Error("Configuração de segurança crítica incompleta (Chave ausente).");
  }
  try {
    const keyBuffer = Uint8Array.from(atob(encryptionKeyString), c => c.charCodeAt(0));
    if (keyBuffer.byteLength !== 32) {
        throw new Error("CREDENTIALS_ENCRYPTION_KEY precisa ter 32 bytes (256 bits) após decode base64.");
    }
    return await crypto.subtle.importKey(
      "raw", keyBuffer, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
    );
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    console.error("Erro ao importar CREDENTIALS_ENCRYPTION_KEY:", errorMessage);
    throw new Error(`Falha ao processar chave de criptografia: ${errorMessage}`);
  }
}

export async function encryptValue(value: string, cryptoKey: CryptoKey): Promise<{ iv_hex: string; ciphertext_hex: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // AES-GCM standard IV size
  const encodedValue = new TextEncoder().encode(value);
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv }, cryptoKey, encodedValue
  );
  return {
    iv_hex: uint8ArrayToHex(iv),
    ciphertext_hex: uint8ArrayToHex(new Uint8Array(ciphertextBuffer)),
  };
}

export async function decryptValue(iv_hex: string, ciphertext_hex: string, cryptoKey: CryptoKey): Promise<string> {
  const iv = hexToUint8Array(iv_hex);
  const ciphertext = hexToUint8Array(ciphertext_hex);
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv }, cryptoKey, ciphertext
  );
  return new TextDecoder().decode(decryptedBuffer);
} 