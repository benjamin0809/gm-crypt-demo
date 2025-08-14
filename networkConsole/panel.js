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

  let isPaused = false;
  let allRecords = [];
  let displayedRecords = [];
  let selectedId = null;

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

      onNewRecord(rec);
    });
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
    subscribeToNetwork();
  }

  init();
})();


