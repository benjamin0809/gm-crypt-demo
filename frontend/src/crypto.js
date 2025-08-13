import { SM4 } from 'gm-crypto-wasm';

const DEFAULT_KEY = import.meta.env?.VITE_SM4_KEY || '0123456789abcdeffedcba9876543210';
const DEFAULT_IV = import.meta.env?.VITE_SM4_IV || 'fedcba98765432100123456789abcdef';
const DEFAULT_MODE = 'ecb';

function isValidHex(str, len) {
	return typeof str === 'string' && /^[0-9a-fA-F]+$/.test(str) && (len ? str.length === len : str.length % 2 === 0);
}

function isBase64String(str) {
	if (typeof str !== 'string' || str.length === 0 || str.length % 4 !== 0) return false;
	return /^[A-Za-z0-9+/]+={0,2}$/.test(str);
}

function buildOptions(mode, iv) {
	if (mode === 'cbc') {
		if (!isValidHex(iv, 32)) throw new Error('Invalid IV for CBC');
		return { mode: SM4.constants.CBC, iv };
	}
	return { mode: SM4.constants.ECB };
}

export function encryptPayload(payload, key = DEFAULT_KEY, iv = DEFAULT_IV, mode = DEFAULT_MODE) {
	const json = typeof payload === 'string' ? payload : JSON.stringify(payload);
	const opts = buildOptions(mode, iv);
	return SM4.encrypt(json, key, { ...opts, inputEncoding: 'utf8', outputEncoding: 'base64' });
}

export function decryptPayload(ciphertext, key = DEFAULT_KEY, iv = DEFAULT_IV, mode = DEFAULT_MODE) {
	const opts = buildOptions(mode, iv);
	const text = String(ciphertext || '');
	const inputEncoding = isBase64String(text) ? 'base64' : (isValidHex(text) ? 'hex' : null);
	if (!inputEncoding) throw new Error('Unsupported ciphertext format');
	const plain = SM4.decrypt(text, key, { ...opts, inputEncoding, outputEncoding: 'utf8' });
	try {
		return JSON.parse(plain);
	} catch (_) {
		return plain;
	}
} 