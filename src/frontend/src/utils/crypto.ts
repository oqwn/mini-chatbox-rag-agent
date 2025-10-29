import CryptoJS from 'crypto-js';

// Generate a unique encryption key for each browser
const getOrCreateEncryptionKey = (): string => {
  const storageKey = 'chatbox_encryption_key';
  let key = localStorage.getItem(storageKey);

  if (!key) {
    // Generate a random key unique to this browser
    key = CryptoJS.lib.WordArray.random(256 / 8).toString();
    localStorage.setItem(storageKey, key);
  }

  return key;
};

export const encrypt = (text: string): string => {
  const key = getOrCreateEncryptionKey();
  return CryptoJS.AES.encrypt(text, key).toString();
};

export const decrypt = (encryptedText: string): string => {
  try {
    const key = getOrCreateEncryptionKey();
    const bytes = CryptoJS.AES.decrypt(encryptedText, key);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error('Failed to decrypt:', error);
    return '';
  }
};

// Check if a value is encrypted (simple heuristic)
export const isEncrypted = (value: string): boolean => {
  // CryptoJS AES encrypted strings typically start with "U2FsdGVkX1"
  return value.startsWith('U2FsdGVkX1');
};
