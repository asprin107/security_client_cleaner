'use strict';
const $ = (id) => document.getElementById(id);
let results = [];
const selected = new Set();

function render() {
  const showAll = $('showAll').checked;
  const list = $('list');
  const shown = results.filter((r) => r.installed || showAll);
  if (!shown.length) {
    list.innerHTML = '<div class="empty">설치된 대상 보안 클라이언트를 찾지 못했습니다. 🎉</div>';
    updateCount();
    return;
  }
  list.innerHTML = '';
  for (const r of shown) {
    const card = document.createElement('div');
    card.className = 'card' + (r.installed ? '' : ' notinstalled');
    const checkbox = r.installed
      ? `<input type="checkbox" data-id="${r.id}" ${selected.has(r.id) ? 'checked' : ''} />`
      : '<input type="checkbox" disabled />';
    const badge = r.installed ? '<span class="badge on">설치됨</span>' : '<span class="badge off">미설치</span>';
    const evidence = r.evidence.map((e) => `<div>${escapeHtml(e)}</div>`).join('');
    card.innerHTML = `${checkbox}
      <div class="body">
        <div class="name">${escapeHtml(r.name)} <span class="vendor">${escapeHtml(r.vendor)}</span> ${badge}</div>
        ${evidence ? `<div class="evidence">${evidence}</div>` : ''}
      </div>`;
    list.appendChild(card);
  }
  list.querySelectorAll('input[data-id]').forEach((cb) => {
    cb.addEventListener('change', () => {
      if (cb.checked) selected.add(cb.dataset.id); else selected.delete(cb.dataset.id);
      updateCount();
    });
  });
  updateCount();
}

function updateCount() {
  $('count').textContent = `선택: ${selected.size}`;
  const none = selected.size === 0;
  $('preview').disabled = none;
  $('removeBtn').disabled = none;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function showLog(text) {
  const log = $('log');
  log.textContent = text;
  log.classList.add('show');
}

async function doScan() {
  $('list').innerHTML = '<div class="empty">스캔 중…</div>';
  $('log').classList.remove('show');
  selected.clear();
  const res = await window.api.scan();
  results = res.results;
  $('platform').textContent = `platform: ${res.platform}`;
  render();
}

$('rescan').addEventListener('click', doScan);
$('showAll').addEventListener('change', render);
$('selectAll').addEventListener('click', () => {
  const installed = results.filter((r) => r.installed);
  const allSel = installed.every((r) => selected.has(r.id));
  installed.forEach((r) => allSel ? selected.delete(r.id) : selected.add(r.id));
  render();
});

$('preview').addEventListener('click', async () => {
  const plan = await window.api.plan([...selected]);
  showLog('# DRY-RUN — 아래 명령이 실제 삭제 시 실행됩니다 (지금은 아무것도 변경하지 않음)\n\n' + (plan.commands.join('\n') || '(없음)'));
});

$('removeBtn').addEventListener('click', () => {
  const names = results.filter((r) => selected.has(r.id)).map((r) => r.name);
  $('modalText').innerHTML = `<b>${selected.size}개</b> 클라이언트를 삭제합니다:<br>• ${names.map(escapeHtml).join('<br>• ')}`;
  $('modalBg').classList.add('show');
});

$('modalCancel').addEventListener('click', () => $('modalBg').classList.remove('show'));
$('modalOk').addEventListener('click', async () => {
  $('modalBg').classList.remove('show');
  showLog('삭제 진행 중… 권한 입력 창을 확인하세요.');
  const res = await window.api.remove([...selected]);
  if (res.error) {
    showLog('❌ 실패: ' + res.error + '\n\n' + (res.stderr || ''));
  } else {
    showLog('✅ 삭제 완료\n\n' + (res.stdout || '') + (res.stderr ? '\n[stderr]\n' + res.stderr : ''));
    await doScan();
  }
});

doScan();
