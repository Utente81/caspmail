// In a real military-grade setup, this token would be injected via Kubernetes Secrets
// and rotated dynamically using Vault Agent or a similar mechanism.
// For this implementation, we read from env or use the dev token.
const VAULT_ADDR = process.env.VAULT_ADDR || 'http://casper-vault.caspermail.svc.cluster.local:8200';
const VAULT_TOKEN = process.env.VAULT_TOKEN;
if (!VAULT_TOKEN) console.warn('[Vault] WARNING: VAULT_TOKEN environment variable is not set!');
const TRANSIT_KEY_NAME = 'caspmail-soc-key';

/**
 * Encrypts a plaintext string using Vault's Transit Engine.
 * @param {string} plaintext - The data to encrypt
 * @returns {Promise<string>} The ciphertext (e.g. vault:v1:...)
 */
export async function encryptData(plaintext) {
    if (!plaintext) return plaintext;
    try {
        const base64Data = Buffer.from(plaintext).toString('base64');
        const response = await fetch(`${VAULT_ADDR}/v1/transit/encrypt/${TRANSIT_KEY_NAME}`, {
            method: 'POST',
            headers: {
                'X-Vault-Token': VAULT_TOKEN,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ plaintext: base64Data })
        });
        
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Vault encryption failed: ${response.status} ${errText}`);
        }
        
        const data = await response.json();
        return data.data.ciphertext;
    } catch (error) {
        console.error('[Vault] Encryption Error:', error);
        throw error;
    }
}

/**
 * Decrypts a ciphertext string using Vault's Transit Engine.
 * @param {string} ciphertext - The vault ciphertext (e.g. vault:v1:...)
 * @returns {Promise<string>} The decrypted plaintext
 */
export async function decryptData(ciphertext) {
    if (!ciphertext || !ciphertext.startsWith('vault:v1:')) return ciphertext;
    try {
        const response = await fetch(`${VAULT_ADDR}/v1/transit/decrypt/${TRANSIT_KEY_NAME}`, {
            method: 'POST',
            headers: {
                'X-Vault-Token': VAULT_TOKEN,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ciphertext: ciphertext })
        });
        
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Vault decryption failed: ${response.status} ${errText}`);
        }
        
        const data = await response.json();
        return Buffer.from(data.data.plaintext, 'base64').toString('utf8');
    } catch (error) {
        console.error('[Vault] Decryption Error:', error);
        throw error;
    }
}
