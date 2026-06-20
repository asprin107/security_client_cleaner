'use strict';
// clients.json (단일 진실 공급원)을 로드한다. dev/패키징 양쪽 경로를 시도.
const fs = require('fs');
const path = require('path');

function resolveCatalogPath() {
  const candidates = [
    process.env.SCC_CATALOG,
    path.join(__dirname, '..', '..', 'clients.json'),       // app/clients.json (dev)
    process.resourcesPath && path.join(process.resourcesPath, 'clients.json'), // 패키징 시
  ].filter(Boolean);
  for (const p of candidates) {
    try { if (fs.existsSync(p)) return p; } catch (_) {}
  }
  throw new Error('clients.json 을 찾을 수 없습니다. SCC_CATALOG 환경변수로 경로를 지정하세요.');
}

function loadCatalog() {
  const p = resolveCatalogPath();
  const json = JSON.parse(fs.readFileSync(p, 'utf8'));
  return json.clients || [];
}

module.exports = { loadCatalog, resolveCatalogPath };
