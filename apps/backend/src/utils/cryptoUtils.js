const crypto = require('crypto');

const SECRET_KEY = process.env.SECRET_KEY;

if (!SECRET_KEY) {
  throw new Error('SECRET_KEY is missing from environment variables!');
}

// Securely derive a 32-byte encryption key from the secret
function deriveKey(secret) {
  return crypto.pbkdf2Sync(secret, 'analysis_salt', 100000, 32, 'sha256');
}

// Encrypt a value using AES-256-CBC with a random IV
function encrypt(text) {
  const key = deriveKey(SECRET_KEY);
  const iv = crypto.randomBytes(16); // Generate a random IV
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted; // Store IV with ciphertext
}

// Decrypt a value using AES-256-CBC
function decrypt(encryptedText) {
  const key = deriveKey(SECRET_KEY);
  const [ivHex, encrypted] = encryptedText.split(':'); // Extract IV
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

module.exports = { encrypt, decrypt };
