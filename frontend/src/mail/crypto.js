// WebCrypto E2EE helpers — private key stays in IndexedDB, never leaves browser

const DB_NAME = 'caspmail_e2ee'
const DB_STORE = 'keys'

// ── IndexedDB ────────────────────────────────────────────────────────────────

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = e => e.target.result.createObjectStore(DB_STORE)
    req.onsuccess = e => resolve(e.target.result)
    req.onerror = () => reject(req.error)
  })
}

function getKeyId() {
  const email = window.memoryStorage.getItem('caspmail_user_email') || window.memoryStorage.getItem('caspmail_user_email')
  return (email && email.trim()) ? email.trim() : 'main'
}

export async function storeKeyPair(keyPair) {
  const db = await openDB()
  const keyId = getKeyId()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite')
    const store = tx.objectStore(DB_STORE)
    store.put(keyPair, keyId)
    if (keyId !== 'main') {
      store.put(keyPair, 'main')
    }
    tx.oncomplete = resolve
    tx.onerror = () => reject(tx.error)
  })
}

export async function loadKeyPair() {
  const db = await openDB()
  const primaryKeyId = getKeyId()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly')
    const store = tx.objectStore(DB_STORE)
    const req = store.get(primaryKeyId)
    req.onsuccess = () => {
      if (req.result) {
        resolve(req.result)
      } else {
        const fallbackReq = store.get('main')
        fallbackReq.onsuccess = () => resolve(fallbackReq.result || null)
        fallbackReq.onerror = () => resolve(null)
      }
    }
    req.onerror = () => reject(req.error)
  })
}

export async function deleteKeyPair() {
  const db = await openDB()
  const keyId = getKeyId()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite')
    const store = tx.objectStore(DB_STORE)
    store.delete(keyId)
    store.delete('main')
    tx.oncomplete = resolve
    tx.onerror = () => reject(tx.error)
  })
}

// ── Key Generation ───────────────────────────────────────────────────────────

export async function generateKeyPair() {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'RSA-OAEP', modulusLength: 4096, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true, // private key extractable for backup
    ['encrypt', 'decrypt']
  )
  return keyPair
}

export async function exportPublicKeyPem(publicKey) {
  const spki = await crypto.subtle.exportKey('spki', publicKey)
  const b64 = btoa(String.fromCharCode(...new Uint8Array(spki)))
  return `-----BEGIN PUBLIC KEY-----\n${b64.match(/.{1,64}/g).join('\n')}\n-----END PUBLIC KEY-----`
}

export async function fingerprintPublicKey(publicKey) {
  const spki = await crypto.subtle.exportKey('spki', publicKey)
  const hash = await crypto.subtle.digest('SHA-256', spki)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join(':').slice(0, 47)
}

// ── Import public key from PEM ────────────────────────────────────────────────

export async function importPublicKeyPem(pem) {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '')
  const der = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
  return crypto.subtle.importKey('spki', der, { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['encrypt'])
}

// ── PreKeys (Perfect Forward Secrecy) ────────────────────────────────────────

export async function storePreKey(prekey_id, keyPair) {
  const db = await openDB()
  const keyId = getKeyId()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite')
    const store = tx.objectStore(DB_STORE)
    store.put(keyPair, `prekey_${keyId}_${prekey_id}`)
    tx.oncomplete = resolve
    tx.onerror = () => reject(tx.error)
  })
}

export async function loadPreKey(prekey_id) {
  const db = await openDB()
  const keyId = getKeyId()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly')
    const store = tx.objectStore(DB_STORE)
    const req = store.get(`prekey_${keyId}_${prekey_id}`)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => reject(req.error)
  })
}

export async function generatePreKeys(count, password) {
  const keys = [];
  for (let i = 0; i < count; i++) {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'RSA-OAEP', modulusLength: 4096, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true, ['encrypt', 'decrypt']
    );
    const prekey_id = crypto.randomUUID();
    const public_key = await exportPublicKeyPem(keyPair.publicKey);
    const { private_key_encrypted, private_key_salt } = await encryptPrivateKey(keyPair.privateKey, password);
    const packed_private = btoa(`${private_key_encrypted}|${private_key_salt}`);
    await storePreKey(prekey_id, keyPair);
    keys.push({ prekey_id, public_key, private_key_encrypted: packed_private });
  }
  return keys;
}

export async function decryptPreKey(packed_private_b64, password) {
  const packed = atob(packed_private_b64);
  const [enc, salt] = packed.split('|');
  return decryptPrivateKey(enc, salt, password);
}

// ── Hybrid Encrypt (RSA-OAEP + AES-GCM) ─────────────────────────────────────

export async function encryptMessage(recipientPublicKey, subject, body) {
  const aesKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
  const rawAes = await crypto.subtle.exportKey('raw', aesKey)

  const encryptedAesKey = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, recipientPublicKey, rawAes)

  const subjectIv = crypto.getRandomValues(new Uint8Array(12))
  const bodyIv = crypto.getRandomValues(new Uint8Array(12))

  const enc = new TextEncoder()
  const encSubject = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: subjectIv }, aesKey, enc.encode(subject))
  const encBody = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: bodyIv }, aesKey, enc.encode(body))

  const nonce = JSON.stringify({
    k: b64(encryptedAesKey),
    si: b64(subjectIv),
    bi: b64(bodyIv),
  })

  return {
    subject_encrypted: b64(encSubject),
    body_encrypted: b64(encBody),
    nonce,
  }
}

// ── Decrypt ──────────────────────────────────────────────────────────────────

export async function decryptMessage(privateKey, subject_encrypted, body_encrypted, nonce) {
  const { k, si, bi } = JSON.parse(nonce)

  const rawAes = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, unb64(k))
  const aesKey = await crypto.subtle.importKey('raw', rawAes, { name: 'AES-GCM' }, false, ['decrypt'])

  const dec = new TextDecoder()
  const subject = dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(si) }, aesKey, unb64(subject_encrypted)))
  const body = dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(bi) }, aesKey, unb64(body_encrypted)))

  return { subject, body }
}

export async function encryptAttachment(recipientPublicKey, fileBuffer) {
  const aesKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
  const rawAes = await crypto.subtle.exportKey('raw', aesKey)
  const encryptedAesKey = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, recipientPublicKey, rawAes)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encryptedData = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, fileBuffer)

  return {
    data: b64(encryptedData),
    nonce: JSON.stringify({ k: b64(encryptedAesKey), iv: b64(iv) })
  }
}

export async function decryptAttachment(privateKey, dataEncryptedB64, nonceStr) {
  const { k, iv } = JSON.parse(nonceStr)
  const rawAes = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, unb64(k))
  const aesKey = await crypto.subtle.importKey('raw', rawAes, { name: 'AES-GCM' }, false, ['decrypt'])
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, aesKey, unb64(dataEncryptedB64))
  return new Uint8Array(decrypted)
}

function b64(buf) {
  const bytes = new Uint8Array(buf instanceof ArrayBuffer ? buf : buf.buffer ?? buf)
  let binary = ''
  const chunkSize = 8192
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}
function unb64(s) { return Uint8Array.from(atob(s), c => c.charCodeAt(0)) }

// ── Key Escrow / Recovery ───────────────────────────────────────────────────

async function deriveKeyFromPassword(password, saltUint8) {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  )
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltUint8,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )
}

export async function encryptPrivateKey(privateKey, password) {
  const pkcs8 = await crypto.subtle.exportKey('pkcs8', privateKey)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const aesKey = await deriveKeyFromPassword(password, salt)
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    pkcs8
  )
  
  const combined = new Uint8Array(iv.length + encrypted.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(encrypted), iv.length)
  
  return {
    private_key_encrypted: b64(combined),
    private_key_salt: b64(salt)
  }
}

export async function decryptPrivateKey(encryptedB64, saltB64, password) {
  const combined = unb64(encryptedB64)
  const salt = unb64(saltB64)
  const iv = combined.slice(0, 12)
  const ciphertext = combined.slice(12)
  
  const aesKey = await deriveKeyFromPassword(password, salt)
  const pkcs8 = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    ciphertext
  )
  
  return crypto.subtle.importKey(
    'pkcs8',
    pkcs8,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true,
    ['decrypt']
  )
}

export async function exportPrivateKeyPem(privateKey) {
  const pkcs8 = await crypto.subtle.exportKey('pkcs8', privateKey)
  const b64 = btoa(String.fromCharCode(...new Uint8Array(pkcs8)))
  const formatted = b64.match(/.{1,64}/g).join('\n')
  return `-----BEGIN PRIVATE KEY-----\n${formatted}\n-----END PRIVATE KEY-----`
}

// ── Enterprise Key Escrow (Shamir's Secret Sharing) ─────────────────────────
import secrets from 'secrets.js-grempe';

export async function generateCorporateMasterKey(sharesCount = 3, threshold = 2) {
  // Generate RSA-4096 Master Key
  const keyPair = await generateKeyPair();
  const publicKeyPem = await exportPublicKeyPem(keyPair.publicKey);
  const privateKeyPem = await exportPrivateKeyPem(keyPair.privateKey);
  
  // Convert private key PEM to Hex for Shamir sharing
  const privateKeyHex = secrets.str2hex(privateKeyPem);
  
  // Split the private key into shares
  const shares = secrets.share(privateKeyHex, sharesCount, threshold);
  
  return {
    publicKeyPem,
    shares // e.g. ["801xxx", "802yyy", "803zzz"] to be given to CEO, Admin, DPO
  };
}

export async function unlockCorporateMasterKey(shares) {
  try {
    // Combine shares to reconstruct the private key HEX
    const reconstructedHex = secrets.combine(shares);
    const privateKeyPem = secrets.hex2str(reconstructedHex);
    
    // Import the reconstructed PEM into a CryptoKey
    const b64 = privateKeyPem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
    const der = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    
    return await crypto.subtle.importKey(
      'pkcs8',
      der,
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      true,
      ['decrypt']
    );
  } catch (e) {
    console.error("Failed to reconstruct Master Key from shares", e);
    throw new Error("Invalid or insufficient Shamir shares provided.");
  }
}

export async function escrowPrivateKey(privateKey, corporatePublicKeyPem) {
  // Extract user's private key as raw bytes
  const pkcs8 = await crypto.subtle.exportKey('pkcs8', privateKey);
  
  // Encrypt the user's private key with a new AES key
  const aesKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const rawAes = await crypto.subtle.exportKey('raw', aesKey);
  
  // Encrypt the AES key with the Corporate Master Public Key
  const corporatePublicKey = await importPublicKeyPem(corporatePublicKeyPem);
  const encryptedAesKey = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, corporatePublicKey, rawAes);
  
  // Encrypt the PKCS8 private key with the AES key
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encryptedPkcs8 = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, pkcs8);
  
  return {
    escrow_data: b64(encryptedPkcs8),
    escrow_aes: b64(encryptedAesKey),
    escrow_iv: b64(iv)
  };
}

export async function unescrowPrivateKey(corporateMasterPrivateKey, escrowDataB64, escrowAesB64, escrowIvB64) {
  // Decrypt the AES key using the Corporate Master Private Key
  const rawAes = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, corporateMasterPrivateKey, unb64(escrowAesB64));
  const aesKey = await crypto.subtle.importKey('raw', rawAes, { name: 'AES-GCM' }, false, ['decrypt']);
  
  // Decrypt the PKCS8 private key
  const pkcs8 = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(escrowIvB64) }, aesKey, unb64(escrowDataB64));
  
  return await crypto.subtle.importKey(
    'pkcs8',
    pkcs8,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true,
    ['decrypt']
  );
}

