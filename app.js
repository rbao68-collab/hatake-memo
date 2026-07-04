/* ===== 畑メモ v0.1 アプリ本体（批次2）===== */
'use strict';

/* ============================================================
   データ層：localStorage 単一キー
   ============================================================ */
const STORAGE_KEY = 'hatake-memo-v1';

/** ユニークID：時刻(36進) + '-' + ランダム短串 */
function genId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
}

/** 保存データを読む（無ければ初期構造） */
function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { sales: [], works: [] };
    const data = JSON.parse(raw);
    return {
      sales: Array.isArray(data.sales) ? data.sales : [],
      works: Array.isArray(data.works) ? data.works : [],
    };
  } catch (e) {
    return { sales: [], works: [] };
  }
}

/** 配列を id で去重マージ（後勝ち） */
function mergeById(oldArr, newArr) {
  const map = new Map();
  oldArr.forEach((r) => { if (r && r.id) map.set(r.id, r); });
  newArr.forEach((r) => { if (r && r.id) map.set(r.id, r); });
  return Array.from(map.values());
}

/** 生データを書き込む（内部用） */
function commit(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  return data;
}

/**
 * 旧値を読み、patch を id 去重でマージして書き込む。
 * patch = { sales?: [...], works?: [...] }
 */
function saveData(patch) {
  const cur = loadData();
  const next = {
    sales: patch.sales ? mergeById(cur.sales, patch.sales) : cur.sales,
    works: patch.works ? mergeById(cur.works, patch.works) : cur.works,
  };
  return commit(next);
}

/** id 指定で1件削除（type: 'sales' | 'works'） */
function deleteRecord(type, id) {
  const cur = loadData();
  cur[type] = cur[type].filter((r) => r.id !== id);
  return commit(cur);
}

/* ============================================================
   共通ユーティリティ
   ============================================================ */

/** Date → 'YYYY-MM-DD' */
function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 今日の 'YYYY-MM-DD' */
function todayStr() {
  return toDateStr(new Date());
}

/** 数値 → '¥1,234' */
function yen(n) {
  return '¥' + (Number(n) || 0).toLocaleString('ja-JP');
}

/** トースト表示 */
let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.hidden = false;
  el.classList.add('is-show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove('is-show');
    setTimeout(() => { el.hidden = true; }, 250);
  }, 1600);
}

/* ============================================================
   タブ切り替え
   ============================================================ */
const SCREENS = {
  sales:   document.getElementById('screen-sales'),
  work:    document.getElementById('screen-work'),
  records: document.getElementById('screen-records'),
};

function switchTab(name) {
  Object.entries(SCREENS).forEach(([key, el]) => {
    el.hidden = key !== name;
  });
  document.querySelectorAll('.tab').forEach((btn) => {
    const active = btn.dataset.tab === name;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  if (name === 'records') renderRecords();
  if (name === 'sales') resetSaleFlow();
}

document.querySelectorAll('.tab').forEach((btn) => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

/* ============================================================
   画面A：売上（3ステップ）
   ============================================================ */
const saleState = { item: null, amount: '', date: todayStr(), dest: null };

const saleSteps = {
  1: document.querySelector('#screen-sales .step[data-step="1"]'),
  2: document.querySelector('#screen-sales .step[data-step="2"]'),
  3: document.querySelector('#screen-sales .step[data-step="3"]'),
};
const saleItemChip = document.getElementById('sale-item-chip');
const saleAmountInput = document.getElementById('sale-amount');
const saleDateInput = document.getElementById('sale-date');

function showSaleStep(n) {
  Object.entries(saleSteps).forEach(([k, el]) => { el.hidden = Number(k) !== n; });
}

function resetSaleFlow() {
  saleState.item = null;
  saleState.amount = '';
  saleState.date = todayStr();
  saleState.dest = null;
  saleAmountInput.value = '';
  saleDateInput.value = saleState.date;
  saleItemChip.textContent = '—';
  showSaleStep(1);
}

/* Step1：品目選択 → Step2 へ */
document.querySelectorAll('#screen-sales .big-btn[data-item]').forEach((btn) => {
  btn.addEventListener('click', () => {
    saleState.item = btn.dataset.item;
    saleItemChip.textContent = saleState.item;
    saleDateInput.value = saleState.date;
    showSaleStep(2);
    setTimeout(() => saleAmountInput.focus(), 50);
  });
});

/* もどる／すすむ */
document.querySelectorAll('#screen-sales [data-goto]').forEach((btn) => {
  btn.addEventListener('click', () => showSaleStep(Number(btn.dataset.goto)));
});

document.getElementById('sale-to-3').addEventListener('click', () => {
  const amount = parseInt(saleAmountInput.value.replace(/[^0-9]/g, ''), 10);
  if (!amount || amount <= 0) {
    showToast('金額を入力してください');
    saleAmountInput.focus();
    return;
  }
  saleState.amount = amount;
  saleState.date = saleDateInput.value || todayStr();
  showSaleStep(3);
});

/* Step3：販売先タップ → 保存 */
document.querySelectorAll('#screen-sales .save-dest').forEach((btn) => {
  btn.addEventListener('click', () => {
    saleState.dest = btn.dataset.dest;
    const rec = {
      id: genId(),
      date: saleState.date,
      item: saleState.item,
      amount: saleState.amount,
      dest: saleState.dest,
      createdAt: Date.now(),
    };
    saveData({ sales: [rec] });
    showToast(`保存しました：${rec.item} ${yen(rec.amount)}`);
    resetSaleFlow();
  });
});

/* ============================================================
   画面B：作業（一発打刻）
   ============================================================ */
document.querySelectorAll('#screen-work .work-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const rec = {
      id: genId(),
      date: todayStr(),
      kind: btn.dataset.work,
      createdAt: Date.now(),
    };
    saveData({ works: [rec] });
    showToast(`記録しました：${rec.kind}`);
  });
});

/* ============================================================
   画面C：記録（月グループ + 当月合計 + 削除）
   ============================================================ */
const WORK_EMOJI = {
  '水やり': '💧', '収穫': '🧺', '防除': '🧴', '電柵点検': '⚡', 'その他': '📝',
};
const ITEM_EMOJI = {
  'スイカ': '🍉', '米': '🌾', '野菜': '🥬', 'その他': '📦',
};

/** 'YYYY-MM-DD' → 'YYYY年M月' */
function monthKey(dateStr) {
  const [y, m] = dateStr.split('-');
  return `${y}-${m}`;
}
function monthLabel(key) {
  const [y, m] = key.split('-');
  return `${y}年${Number(m)}月`;
}

function renderRecords() {
  const data = loadData();

  // 当月売上合計
  const curKey = monthKey(todayStr());
  const monthTotal = data.sales
    .filter((s) => monthKey(s.date) === curKey)
    .reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
  document.getElementById('month-total').textContent = yen(monthTotal);

  // 売上・作業を1つの配列に統合
  const rows = [
    ...data.sales.map((s) => ({ ...s, _type: 'sales' })),
    ...data.works.map((w) => ({ ...w, _type: 'works' })),
  ];

  const listEl = document.getElementById('records-list');

  if (rows.length === 0) {
    listEl.innerHTML = '<p class="empty-msg">まだ記録がありません。<br>下のタブから入力できます。</p>';
    return;
  }

  // 月キーでグループ化
  const groups = {};
  rows.forEach((r) => {
    const k = monthKey(r.date);
    (groups[k] = groups[k] || []).push(r);
  });

  // 月は新しい順、月内は作成時刻の新しい順
  const sortedKeys = Object.keys(groups).sort().reverse();

  listEl.innerHTML = '';
  sortedKeys.forEach((k) => {
    const items = groups[k].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    // 月見出し（その月の売上合計も表示）
    const mTotal = items
      .filter((r) => r._type === 'sales')
      .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

    const header = document.createElement('div');
    header.className = 'month-header';
    header.innerHTML =
      `<span class="mh-label">${monthLabel(k)}</span>` +
      `<span class="mh-total">売上 ${yen(mTotal)}</span>`;
    listEl.appendChild(header);

    items.forEach((r) => {
      const card = document.createElement('div');
      card.className = 'rec-card rec-' + r._type;

      const dd = r.date.split('-');
      const dayLabel = `${Number(dd[1])}/${Number(dd[2])}`;

      let main = '';
      if (r._type === 'sales') {
        main =
          `<span class="rec-emoji">${ITEM_EMOJI[r.item] || '📦'}</span>` +
          `<span class="rec-main">` +
            `<span class="rec-row1">` +
              `<span class="rec-title">${r.item}</span>` +
              `<span class="rec-amount">${yen(r.amount)}</span>` +
            `</span>` +
            `<span class="rec-dest">${r.dest}</span>` +
          `</span>`;
      } else {
        main =
          `<span class="rec-emoji">${WORK_EMOJI[r.kind] || '📝'}</span>` +
          `<span class="rec-main">` +
            `<span class="rec-row1">` +
              `<span class="rec-title">${r.kind}</span>` +
              `<span class="rec-tag">作業</span>` +
            `</span>` +
          `</span>`;
      }

      card.innerHTML =
        `<span class="rec-day">${dayLabel}</span>` +
        main +
        `<button class="del-btn" aria-label="削除">✕</button>`;

      card.querySelector('.del-btn').addEventListener('click', () => {
        const what = r._type === 'sales'
          ? `${r.item} ${yen(r.amount)}`
          : r.kind;
        if (confirm(`この記録を削除しますか？\n\n${dayLabel}　${what}`)) {
          deleteRecord(r._type, r.id);
          renderRecords();
          showToast('削除しました');
        }
      });

      listEl.appendChild(card);
    });
  });
}

/* ============================================================
   CSV書き出し
   列：種別(売上/作業),日付,内容,金額,販売先
   （作業行は 金額・販売先 を空欄）／ UTF-8 with BOM
   ============================================================ */
function csvEscape(s) {
  const v = (s === null || s === undefined) ? '' : String(s);
  return '"' + v.replace(/"/g, '""') + '"';
}

function buildCSV() {
  const d = loadData();
  const rows = [
    ...d.sales.map((s) => ({
      type: '売上', date: s.date, content: s.item,
      amount: s.amount, dest: s.dest, createdAt: s.createdAt,
    })),
    ...d.works.map((w) => ({
      type: '作業', date: w.date, content: w.kind,
      amount: '', dest: '', createdAt: w.createdAt,
    })),
  ].sort((a, b) => (
    a.date < b.date ? -1 : a.date > b.date ? 1 : (a.createdAt || 0) - (b.createdAt || 0)
  ));

  const header = ['種別', '日付', '内容', '金額', '販売先'];
  const lines = [header.map(csvEscape).join(',')];
  rows.forEach((r) => {
    lines.push([r.type, r.date, r.content, r.amount, r.dest].map(csvEscape).join(','));
  });
  return lines.join('\r\n');
}

async function exportCSV() {
  const d = loadData();
  if (d.sales.length === 0 && d.works.length === 0) {
    showToast('記録がありません');
    return;
  }
  const csv = '\uFEFF' + buildCSV();       // UTF-8 with BOM
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const fname = 'hatake-memo_' + todayStr() + '.csv';

  // ① Web Share API（ファイル共有可能なら優先）
  try {
    const file = new File([blob], fname, { type: 'text/csv' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: '畑メモ 記録' });
      return;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return;        // ユーザーがキャンセル
    // それ以外は下のダウンロードへフォールバック
  }

  // ② フォールバック：<a download> で直接ダウンロード
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fname;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('CSVをダウンロードしました');
}

document.getElementById('csv-btn').addEventListener('click', exportCSV);

/* ============================================================
   ごようぼう（フィードバック）：mailto 起動
   ============================================================ */
function sendFeedback() {
  const to = 'info@az-llc.co.jp';
  const subject = '畑メモ ごようぼう';
  const body =
    'ごようぼう・お困りごと：\n' +
    '（ここにご記入ください）\n' +
    '\n' +
    '---\n' +
    '畑メモ v0.1.2';
  const url = 'mailto:' + to +
    '?subject=' + encodeURIComponent(subject) +
    '&body=' + encodeURIComponent(body);
  window.location.href = url;
}

document.getElementById('feedback-btn').addEventListener('click', sendFeedback);

/* ============================================================
   起動時
   ============================================================ */
resetSaleFlow();

/* ---- Service Worker 登録（オフライン対応）---- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
