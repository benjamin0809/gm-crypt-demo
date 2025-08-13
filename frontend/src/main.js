import http from './http';

const app = document.getElementById('app');

function html(strings, ...values) {
	return strings.reduce((acc, s, i) => acc + s + (values[i] ?? ''), '');
}

function render(state) {
	app.innerHTML = html`
		<div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, PingFang SC, Microsoft YaHei, sans-serif; padding: 24px;">
			<h2>gm-crypt 前端示例</h2>
			<div style="display:flex; gap:12px; margin-bottom:16px;">
				<button id="btnPing">GET /api/ping</button>
				<button id="btnEcho">POST /api/echo</button>
			</div>
			<pre id="out" style="background:#111;color:#0f0;padding:12px;border-radius:6px;min-height:120px;white-space:pre-wrap;">${state.output}</pre>
		</div>
	`;

	document.getElementById('btnPing').onclick = async () => {
		const res = await http.get('/api/ping');
		state.output = JSON.stringify(res.data, null, 2);
		render(state);
	};

	document.getElementById('btnEcho').onclick = async () => {
		const payload = { hello: 'world', time: Date.now() };
		const res = await http.post('/api/echo', payload);
		state.output = JSON.stringify(res.data, null, 2);
		render(state);
	};
}

render({ output: '点击按钮发起请求，数据将被SM4全文加密传输' }); 