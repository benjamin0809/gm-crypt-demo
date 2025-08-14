/* global chrome */
(function () {
  const rowsEl = document.getElementById('rows');
  const tableEl = document.getElementById('table');
  const paneEl = document.getElementById('pane');
  const filterEl = document.getElementById('filter');
  const methodEl = document.getElementById('method');
  const toggleEl = document.getElementById('toggle');
  const clearEl = document.getElementById('clear');
  const exportEl = document.getElementById('export');
  const captureBodiesEl = document.getElementById('captureBodies');
  const enableDecryptEl = document.getElementById('enableDecrypt');
  const decryptFnEl = document.getElementById('decryptFn');
  const applyDecryptEl = document.getElementById('applyDecrypt');

  let isPaused = false;
  let allRecords = [];
  let displayedRecords = [];
  let selectedId = null;
  const pendingByKey = new Map();

  function formatBytes(bytes) {
    if (bytes == null) return '';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + sizes[i];
  }

  function classifyStatus(status) {
    if (status >= 200 && status < 300) return 'ok';
    if (status >= 300 && status < 400) return 'warn';
    return 'err';
  }

  function applyFilter() {
    const text = filterEl.value.trim().toLowerCase();
    const method = methodEl.value;
    displayedRecords = allRecords.filter((r) => {
      if (method && r.request.method !== method) return false;
      if (!text) return true;
      const hay = [
        r.request.url,
        r.request.method,
        String(r.response?.status || ''),
        r.initiator?.type || '',
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(text);
    });
    renderTable();
  }

  function renderTable() {
    rowsEl.innerHTML = '';
    displayedRecords.forEach((rec, idx) => {
      const tr = document.createElement('tr');
      tr.dataset.id = rec.id;
      if (rec.id === selectedId) tr.classList.add('active');
      const timeMs = rec.timing?.receiveHeadersEnd != null && rec.timing?.requestTime != null
        ? Math.max(0, Math.round(rec.timing.receiveHeadersEnd))
        : rec.durationMs != null ? Math.round(rec.durationMs) : '';
      const size = rec.encodedDataLength ?? rec.response?.headersText?.length ?? rec.response?.body?.length;
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td>${rec.request.method}</td>
        <td title="${rec.request.url}">${rec.request.url}</td>
        <td class="status ${classifyStatus(rec.response?.status || 0)}">${rec.response?.status ?? ''}</td>
        <td>${rec.initiator?.type || ''}</td>
        <td>${timeMs}</td>
        <td>${size != null ? formatBytes(size) : ''}</td>
      `;
      tr.addEventListener('click', () => selectRecord(rec.id));
      rowsEl.appendChild(tr);
    });
  }

  function selectRecord(id) {
    selectedId = id;
    const rec = allRecords.find((r) => r.id === id);
    if (!rec) return;
    Array.from(rowsEl.children).forEach((tr) => {
      tr.classList.toggle('active', tr.dataset.id === String(id));
    });
    renderDetails(rec);
  }

  function renderDetails(rec) {
    const tabs = document.querySelectorAll('.tabs button');
    tabs.forEach((b) => b.classList.remove('active'));
    const show = (name, contentHtml) => {
      paneEl.innerHTML = contentHtml;
      const btn = Array.from(tabs).find((b) => b.dataset.tab === name);
      if (btn) btn.classList.add('active');
    };

    function code(obj) {
      if (obj == null) return '<pre>(empty)</pre>';
      let text = '';
      if (typeof obj === 'string') {
        text = obj;
      } else if (obj instanceof ArrayBuffer) {
        text = `[binary] ${obj.byteLength} bytes`;
      } else {
        try { text = JSON.stringify(obj, null, 2); } catch (e) { text = String(obj); }
      }
      return `<pre>${escapeHtml(text)}</pre>`;
    }

    function headersToHtml(headersObj, headersText) {
      if (headersText) return `<pre>${escapeHtml(headersText)}</pre>`;
      if (!headersObj) return '<pre>(none)</pre>';
      const lines = Object.entries(headersObj).map(([k, v]) => `${k}: ${v}`).join('\n');
      return `<pre>${escapeHtml(lines)}</pre>`;
    }

    function escapeHtml(str) {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }

    // Wire tabs
    document.querySelectorAll('.tabs button').forEach((btn) => {
      btn.onclick = () => {
        const tab = btn.dataset.tab;
        if (tab === 'overview') {
          show('overview', `
            <div style="padding:10px">
              <div><b>Method</b>: ${rec.request.method}</div>
              <div><b>URL</b>: ${escapeHtml(rec.request.url)}</div>
              <div><b>Status</b>: ${rec.response?.status ?? ''}</div>
              <div><b>Type</b>: ${rec.initiator?.type || ''}</div>
              <div><b>Time</b>: ${rec.durationMs != null ? Math.round(rec.durationMs) + ' ms' : ''}</div>
              <div><b>Transferred</b>: ${rec.encodedDataLength != null ? formatBytes(rec.encodedDataLength) : ''}</div>
            </div>
          `);
        } else if (tab === 'request') {
          show('request', `
            <div style="padding:10px">
              <h4>Request Body</h4>
              ${code(rec.request.body)}
            </div>
          `);
        } else if (tab === 'response') {
          show('response', `
            <div style="padding:10px">
              <h4>Response Body</h4>
              ${code(rec.response?.body)}
            </div>
          `);
        } else if (tab === 'headers') {
          show('headers', `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:10px">
              <div>
                <h4>Request Headers</h4>
                ${headersToHtml(rec.request.headers, rec.request.headersText)}
              </div>
              <div>
                <h4>Response Headers</h4>
                ${headersToHtml(rec.response?.headers, rec.response?.headersText)}
              </div>
            </div>
          `);
        } else if (tab === 'timing') {
          const t = rec.timing || {};
          show('timing', `
            <div style="padding:10px">
              ${code(t)}
            </div>
          `);
        }
      };
    });

    // Default tab
    const defaultBtn = document.querySelector('.tabs button[data-tab="overview"]');
    if (defaultBtn) defaultBtn.click();
  }

  function onNewRecord(rec) {
    allRecords.push(rec);
    tryAttachPlainBodies(rec);
    if (!isPaused) {
      applyFilter();
      if (displayedRecords.length === 1) {
        selectRecord(rec.id);
      }
    }
  }

  function wireToolbar() {
    filterEl.addEventListener('input', applyFilter);
    methodEl.addEventListener('change', applyFilter);
    toggleEl.addEventListener('click', () => {
      isPaused = !isPaused;
      toggleEl.textContent = isPaused ? 'Resume' : 'Pause';
      if (!isPaused) applyFilter();
    });
    clearEl.addEventListener('click', () => {
      allRecords = [];
      displayedRecords = [];
      rowsEl.innerHTML = '';
      paneEl.innerHTML = '';
      selectedId = null;
    });
    exportEl.addEventListener('click', () => {
      const data = JSON.stringify(allRecords, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'network-console.json';
      a.click();
      URL.revokeObjectURL(url);
    });

    applyDecryptEl.addEventListener('click', () => {
      // Re-try decrypt on already captured records
      if (!enableDecryptEl.checked) return;
      const fnName = decryptFnEl.value.trim();
      if (!fnName) return;
      allRecords.forEach((r) => tryDecryptBodies(r, fnName));
      if (selectedId) selectRecord(selectedId);
    });
  }

  function subscribeToNetwork() {
    // Use DevTools protocol via chrome.devtools.network
    chrome.devtools.network.onRequestFinished.addListener(async function (request) {
      if (isPaused) return;

      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const startedMs = request.startedDateTime ? new Date(request.startedDateTime).getTime() : Date.now();
      const rec = {
        id,
        startedDateTime: request.startedDateTime,
        durationMs: request.time,
        encodedDataLength: request.encodedDataLength,
        initiator: request.initiator,
        request: {
          method: request.request.method,
          url: request.request.url,
          headers: request.request.headers?.reduce((acc, h) => (acc[h.name] = h.value, acc), {}) || {},
          headersText: request.requestHeadersText || undefined,
          body: undefined,
        },
        response: {
          status: request.response.status,
          statusText: request.response.statusText,
          headers: request.response.headers?.reduce((acc, h) => (acc[h.name] = h.value, acc), {}) || {},
          headersText: request.responseHeadersText || undefined,
          body: undefined,
        },
        timing: request.timing,
      };

      try {
        // Request body: available via request.request.postData?.text
        if (captureBodiesEl.checked) {
          const postData = request.request?.postData?.text;
          if (postData != null) {
            rec.request.body = tryParseJson(postData);
          }
        }
      } catch (_) {}

      try {
        if (captureBodiesEl.checked) {
          await new Promise((resolve) => request.getContent((content, encoding) => {
            if (content != null && content !== '') {
              if (encoding === 'base64') {
                rec.response.body = `[base64] ${content.length} chars`;
              } else {
                rec.response.body = tryParseJson(content);
              }
            }
            resolve();
          }));
        }
      } catch (_) {}

      // Attempt decrypt using a page-provided function
      tryDecryptBodies(rec, decryptFnEl.value.trim());

      onNewRecord(rec);
    });
  }

  function tryDecryptBodies(rec, fnName) {
    if (!enableDecryptEl.checked || !fnName) return;
    // Use inspectedWindow eval to run in page context
    const evalInPage = (expr) => new Promise((resolve) => {
      chrome.devtools.inspectedWindow.eval(expr, (res, exc) => {
        resolve({ res, exc });
      });
    });

    const safeArg = (value) => {
      try {
        return JSON.stringify(value);
      } catch (_) {
        return 'null';
      }
    };

    const run = async () => {
      // decrypt request body if looks like ciphertext
      if (typeof rec.request.body === 'string' && rec.request.body.length > 0) {
        const expr = `(function(){try{var fn=window[${JSON.stringify(fnName)}];if(typeof fn!=='function')return null;return fn(${safeArg(rec.request.body)});}catch(e){return null;}})()`;
        const { res } = await evalInPage(expr);
        if (res != null) rec.request.decryptedBody = res;
      }
      // decrypt response body if looks like ciphertext or if API wraps as {data: ...}
      const respBody = rec.response?.body;
      if (respBody != null) {
        let candidate = null;
        if (typeof respBody === 'string') candidate = respBody;
        else if (respBody && typeof respBody === 'object' && 'data' in respBody) candidate = respBody.data;
        if (candidate != null) {
          const expr = `(function(){try{var fn=window[${JSON.stringify(fnName)}];if(typeof fn!=='function')return null;return fn(${safeArg(candidate)});}catch(e){return null;}})()`;
          const { res } = await evalInPage(expr);
          if (res != null) rec.response.decryptedBody = res;
        }
      }
    };

    // Fire and forget
    run();
  }

  function tryParseJson(text) {
    const trimmed = String(text).trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try { return JSON.parse(trimmed); } catch (_) { return text; }
    }
    return text;
  }

  function init() {
    wireToolbar();
    ensurePageInstrumentation();
    startPollingPlainEvents();
    subscribeToNetwork();
  }

  function ensurePageInstrumentation() {
    const code = `(function(){
      if (window.__NC_INSTALLED__) return true;
      Object.defineProperty(window, '__NC_INSTALLED__', { value: true, configurable: false });
      window.__NC_EVENTS__ = [];
      function push(evt){ try{ window.__NC_EVENTS__.push(evt);}catch(e){} }
      function now(){ return Date.now(); }
      // Axios interceptors
      try {
        var ax = window.axios;
        if (ax && ax.interceptors) {
          ax.interceptors.request.use(function(config){
            try{
              var url = (config.baseURL||'') + (config.url||'');
              var body = config.data;
              if (typeof body === 'string') { try{ body = JSON.parse(body);}catch(_){}}
              push({ type: 'axios-req', sentAt: now(), method: String((config.method||'GET')).toUpperCase(), url: url, body: body, path: (function(u){ try{var a=new URL(u, location.href); return a.pathname + a.search;}catch(_){return u;} })(url) });
            }catch(_){ }
            return config;
          });
          ax.interceptors.response.use(function(resp){
            try{
              var url = ((resp.config&&resp.config.baseURL)||'') + ((resp.config&&resp.config.url)||'');
              push({ type: 'axios-res', recvAt: now(), method: String((resp.config&&resp.config.method)||'GET').toUpperCase(), url: url, data: resp && resp.data, path: (function(u){ try{var a=new URL(u, location.href); return a.pathname + a.search;}catch(_){return u;} })(url) });
            }catch(_){ }
            return resp;
          });
        }
      } catch(_) {}
      // fetch wrapper
      try {
        var of = window.fetch;
        if (typeof of === 'function' && !of.__nc_patched) {
          function parseMaybeJson(t){ try { return JSON.parse(t); } catch(_) { return t; } }
          var patched = function(input, init){
            var url = (typeof input==='string' ? input : (input && input.url)) || '';
            var method = (init && init.method) || (input && input.method) || 'GET';
            var body = init && init.body;
            if (typeof body !== 'string' && body != null) { try{ body = JSON.stringify(body);}catch(_){ body = String(body);} }
            push({ type: 'fetch-req', sentAt: now(), method: String(method).toUpperCase(), url: url, body: body, path: (function(u){ try{var a=new URL(u, location.href); return a.pathname + a.search;}catch(_){return u;} })(url) });
            return of.apply(this, arguments).then(function(resp){
              try {
                var clone = resp.clone();
                clone.text().then(function(text){
                  push({ type: 'fetch-res', recvAt: now(), method: String(method).toUpperCase(), url: url, data: parseMaybeJson(text), path: (function(u){ try{var a=new URL(u, location.href); return a.pathname + a.search;}catch(_){return u;} })(url) });
                });
              } catch(_) {}
              return resp;
            });
          };
          patched.__nc_patched = true;
          window.fetch = patched;
        }
      } catch(_) {}
      // XHR wrapper
      try {
        var oOpen = XMLHttpRequest.prototype.open;
        var oSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.open = function(method, url){ this.__nc_method = method; this.__nc_url = url; return oOpen.apply(this, arguments); };
        XMLHttpRequest.prototype.send = function(body){
          var b = body;
          if (typeof b !== 'string' && b != null) { try { b = JSON.stringify(b); } catch(_) { b = String(b); } }
          var url = this.__nc_url || '';
          var method = (this.__nc_method||'GET');
          push({ type: 'xhr-req', sentAt: now(), method: String(method).toUpperCase(), url: url, body: b, path: (function(u){ try{var a=new URL(u, location.href); return a.pathname + a.search;}catch(_){return u;} })(url) });
          this.addEventListener('loadend', function(){
            try {
              var data = this.response;
              push({ type: 'xhr-res', recvAt: now(), method: String(method).toUpperCase(), url: url, data: data, path: (function(u){ try{var a=new URL(u, location.href); return a.pathname + a.search;}catch(_){return u;} })(url) });
            } catch(_) {}
          });
          return oSend.apply(this, arguments);
        };
      } catch(_) {}
      return true;
    })();`;
    chrome.devtools.inspectedWindow.eval(code, function () {});
  }

  function startPollingPlainEvents() {
    setInterval(() => {
      chrome.devtools.inspectedWindow.eval(`(function(){ var ev = window.__NC_EVENTS__||[]; window.__NC_EVENTS__=[]; return ev; })()`, (events) => {
        if (!Array.isArray(events) || events.length === 0) return;
        ingestPlainEvents(events);
        // Try to attach to recent records
        const start = Math.max(0, allRecords.length - 50);
        for (let i = start; i < allRecords.length; i++) {
          tryAttachPlainBodies(allRecords[i]);
        }
        if (selectedId) selectRecord(selectedId);
      });
    }, 500);
  }

  function ingestPlainEvents(events) {
    for (const e of events) {
      const method = String(e.method || '').toUpperCase();
      const keyFull = method + ' ' + String(e.url || '');
      const keyPath = method + ' ' + String(e.path || '');
      const keys = [keyFull, keyPath];
      for (const k of keys) {
        if (!pendingByKey.has(k)) pendingByKey.set(k, { reqs: [], ress: [] });
        const bucket = pendingByKey.get(k);
        if (e.type.endsWith('req')) bucket.reqs.push(e);
        else if (e.type.endsWith('res')) bucket.ress.push(e);
      }
    }
  }

  function tryAttachPlainBodies(rec) {
    const method = String(rec.request.method || '').toUpperCase();
    const url = String(rec.request.url || '');
    const path = extractPath(url);
    const keys = [method + ' ' + url, method + ' ' + path];
    for (const k of keys) {
      const bucket = pendingByKey.get(k);
      if (!bucket) continue;
      // Attach request body: select the nearest sentAt before or around start time
      if (rec.request.plainBody == null && bucket.reqs.length) {
        const started = rec.startedDateTime ? new Date(rec.startedDateTime).getTime() : undefined;
        let best = null;
        if (started != null) {
          let bestDiff = Infinity;
          for (const e of bucket.reqs) {
            const diff = Math.abs((e.sentAt || 0) - started);
            if (diff < bestDiff) { bestDiff = diff; best = e; }
          }
        } else {
          best = bucket.reqs[0];
        }
        if (best) rec.request.plainBody = tryParseJson(best.body);
      }
      // Attach response body
      if (rec.response && rec.response.plainBody == null && bucket.ress.length) {
        let best = bucket.ress[0];
        rec.response.plainBody = tryParseJson(best.data);
      }
      // Optionally clean up to prevent unbounded growth
      if (bucket.reqs.length > 1000) bucket.reqs.splice(0, 800);
      if (bucket.ress.length > 1000) bucket.ress.splice(0, 800);
    }
  }

  function extractPath(u) {
    try { const a = new URL(u); return a.pathname + a.search; } catch (_) { return u; }
  }

  init();
})();


