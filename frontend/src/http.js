import axios from 'axios';
import { encryptPayload, decryptPayload } from './crypto';

const baseURL = import.meta.env?.VITE_API_BASE || '';

const http = axios.create({ baseURL, timeout: 10000, headers: { 'Content-Type': 'application/json' } });

http.interceptors.request.use((config) => {
	debugger
	if (config.data && typeof config.data === 'object') {
		config.data = encryptPayload(config.data);
	}
	return config;
});

http.interceptors.response.use((resp) => {
	if (resp?.data && typeof resp.data === 'object' && 'data' in resp.data) {
		const decrypted = decryptPayload(resp.data.data);
		resp.data = decrypted;
	}
	return resp;
});

export default http; 