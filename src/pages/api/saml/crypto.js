import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
// Ensure this matches your NEXTAUTH_SECRET or a custom 32-character string
//const ENCRYPTION_KEY = process.env.NEXTAUTH_SECRET.slice(0, 32); 

const SECRET = process.env.NEXTAUTH_SECRET || "12345678901234567890123456789012"; // 32 chars fallback
const ENCRYPTION_KEY = SECRET.slice(0, 32);

export function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');

  // We store the IV and AuthTag along with the encrypted data
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decrypt(cipherText) {
  const [ivHex, authTagHex, encrypted] = cipherText.split(':');
  
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
  
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}