const express = require('express');
const { decryptRequestMiddleware, encryptResponseMiddleware } = require('./middleware');

const app = express();
const PORT = process.env.PORT || 3000;

// basic CORS
app.use((req, res, next) => {
	const origin = req.headers.origin || '';
	const allow = ['http://127.0.0.1:5173', 'http://localhost:5173'];
	if (allow.includes(origin)) {
		res.header('Access-Control-Allow-Origin', origin);
		res.header('Vary', 'Origin');
	}
	res.header('Access-Control-Allow-Credentials', 'true');
	res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
	res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
	if (req.method === 'OPTIONS') return res.sendStatus(200);
	next();
});

app.use(express.text({ type: 'application/json', limit: '2mb' }));
app.use(decryptRequestMiddleware);
app.use(encryptResponseMiddleware);

app.get('/api/ping', (req, res) => {
	res.json({ pong: true, time: Date.now() });
});

app.post('/api/echo', (req, res) => {
	res.json({ received: req.body, time: Date.now() });
});

app.listen(PORT, () => {
	console.log(`[backend] listening on http://localhost:${PORT}`);
}); 