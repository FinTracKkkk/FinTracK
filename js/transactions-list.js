/* ============================================================
   FinTrack — Full Transactions List
   Defines its own renderTransactions() (loaded after quick-add.js,
   so this version wins) to show the complete list instead of the
   8-item Dashboard preview, with a type filter.
   ============================================================ */

let txFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
  renderTransactions();
  bindDrawer();
  bindFilter();
});

function fmt(amount, currency) {
  const symbol = currency === 'AED' ? 'AED ' : '₹';
  return symbol + Math.abs(amount).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function relativeTime(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  return days + 'd ago';
}

function renderTransactions() {
  const el = document.getElementById('fullTxList');
  if (!el) return;

  let txs = getTransactions();
  if (txFilter !== 'all') txs = txs.filter(t => t.type === txFilter);
  txs = txs.slice().sort((a, b) => new Date(b.date) - new Date(a.date));

  if (txs.length === 0) {
    el.innerHTML = '<div class="empty-state">No transactions yet — tap + to add your first one.</div>';
    return;
  }

  el.innerHTML = txs.map(t => `
    <div class="tx-item" data-id="${t.id}" style="cursor:pointer;">
      <div class="tx-icon">${t.icon}</div>
      <div class="tx-info">
        <div class="t-name">${t.description}</div>
        <div class="t-sub">${t.category} · ${relativeTime(t.date)}</div>
      </div>
      <div class="tx-amount ${t.type}">${t.amount < 0 ? '−' : '+'}${fmt(t.amount, t.currency)}</div>
    </div>
  `).join('');

  el.querySelectorAll('.tx-item').forEach(item => {
    item.addEventListener('click', () => {
      if (typeof openSheetForEdit === 'function') openSheetForEdit(item.dataset.id);
    });
  });
}

function bindFilter() {
  document.querySelectorAll('.segmented button').forEach(btn => {
    btn.addEventListener('click', () => {
      txFilter = btn.dataset.filter;
      document.querySelectorAll('.segmented button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderTransactions();
    });
  });
}

function bindDrawer() {
  const drawer = document.getElementById('drawer');
  const backdrop = document.getElementById('drawerBackdrop');
  document.getElementById('menuBtn').addEventListener('click', () => {
    drawer.classList.add('open'); backdrop.classList.add('open');
  });
  backdrop.addEventListener('click', () => {
    drawer.classList.remove('open'); backdrop.classList.remove('open');
  });
}
