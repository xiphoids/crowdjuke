const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

export function generateJoinCode(length = 6): string {
  let code = "";
  const values = new Uint8Array(length);
  crypto.getRandomValues(values);
  for (let i = 0; i < length; i++) {
    code += ALPHABET[values[i] % ALPHABET.length];
  }
  return code;
}

export function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
