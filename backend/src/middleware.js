const { encryptPayload, decryptPayload, DEFAULT_MODE } = require('./crypto');

function isHexString(str) {
	return typeof str === 'string' && /^[0-9a-fA-F]+$/.test(str);
}

function decryptRequestMiddleware(req, res, next) {
	try {
		if (req.is('application/json') && (req.body !== undefined)) {
			let rawBody = req.body;
			if (typeof rawBody === 'string') {
				// If body is a hex string or a JSON string that is hex, decrypt; else try parse JSON object
				if (isHexString(rawBody)) {
					const decrypted = decryptPayload(rawBody);
					req.body = decrypted;
					req.headers['x-decrypted'] = 'sm4-' + DEFAULT_MODE;
				} else {
					let parsed;
					try {
						parsed = JSON.parse(rawBody);
					} catch (_) {
						return res.status(400).json({ message: 'Invalid JSON body' });
					}
					if (typeof parsed === 'string' && isHexString(parsed)) {
						const decrypted = decryptPayload(parsed);
						req.body = decrypted;
						req.headers['x-decrypted'] = 'sm4-' + DEFAULT_MODE;
					} else if (parsed && typeof parsed === 'object') {
						req.body = parsed;
					} else {
						return res.status(400).json({ message: 'Unsupported JSON body type' });
					}
				}
			} else if (typeof rawBody === 'object') {
				// Some clients may send already-parsed object; if it contains only hex, decrypt
				const maybeCipher = rawBody && rawBody.data;
				if (typeof maybeCipher === 'string' && isHexString(maybeCipher)) {
					const decrypted = decryptPayload(maybeCipher);
					req.body = decrypted;
					req.headers['x-decrypted'] = 'sm4-' + DEFAULT_MODE;
				}
			}
		}
		return next();
	} catch (err) {
		return res.status(400).json({ message: 'Bad encrypted request', details: String(err && err.message || err) });
	}
}

function encryptResponseMiddleware(req, res, next) {
	const originalJson = res.json.bind(res);
	res.json = (body) => {
		try {
			const encrypted = encryptPayload(body);
			res.setHeader('X-Encrypted', 'sm4-' + DEFAULT_MODE);
			return originalJson({ data: encrypted });
		} catch (err) {
			return originalJson({ message: 'Encrypt response failed', details: String(err && err.message || err) });
		}
	};
	return next();
}

module.exports = {
	decryptRequestMiddleware,
	encryptResponseMiddleware,
}; 