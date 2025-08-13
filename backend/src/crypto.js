const { SM4 } = require('gm-crypto-wasm');

// 32-hex (16 bytes)
const DEFAULT_KEY = process.env.SM4_KEY || '0123456789abcdeffedcba9876543210';
const DEFAULT_MODE = 'ecb';

function isHexString(str) {
	return typeof str === 'string' && /^[0-9a-fA-F]+$/.test(str) && str.length % 2 === 0;
}

function isBase64String(str) {
	if (typeof str !== 'string' || str.length === 0 || str.length % 4 !== 0) return false;
	return /^[A-Za-z0-9+/]+={0,2}$/.test(str);
}

function encryptPayload(payload, key = DEFAULT_KEY) {
	const json = typeof payload === 'string' ? payload : JSON.stringify(payload);
	return SM4.encrypt(json, key, { mode: SM4.constants.ECB, inputEncoding: 'utf8', outputEncoding: 'base64' });
}

function decryptPayload(ciphertext, key = DEFAULT_KEY) {
	const text = String(ciphertext || '');
	const inputEncoding = isBase64String(text) ? 'base64' : (isHexString(text) ? 'hex' : null);
	if (!inputEncoding) throw new Error('Unsupported ciphertext format');
	const plain = SM4.decrypt(text, key, { mode: SM4.constants.ECB, inputEncoding, outputEncoding: 'utf8' });
	try {
		return JSON.parse(plain);
	} catch (_) {
		return plain;
	}
}

module.exports = {
	encryptPayload,
	decryptPayload,
	DEFAULT_KEY,
	DEFAULT_MODE,
}; 