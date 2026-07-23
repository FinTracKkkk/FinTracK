/* ============================================================
   FinTrack — Split Expense UI
   ============================================================ */

let currentWallet = 'aed';
let currentTab = 'owed';
let expandedFriendKey = null;
let friendRowCount = 0;

document.addEventListener('DOMContentLoaded', () => {
  bindDrawer();
  bindWalletToggle();
  bindTabs();
  bindSearchFilters();
  bindNewSplitForm();
  bindFriendPayDelegation();
  bindExpenseCardDelegation();
  bindExportAll();
  renderAll();
});

function sym(wallet) { return wallet === 'aed' ? 'AED ' : '₹'; }
function fmt(n, wallet) { return sym(wallet) + (Math.round(n * 100) / 100).toLocaleString('en-IN'); }
function initials(name) { return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join(''); }
function showToast(msg) {
  const t = document.getElementById('saveToast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1800);
}

/* ---------- Drawer ---------- */
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

/* ---------- Currency toggle ---------- */
function bindWalletToggle() {
  document.querySelectorAll('.segmented button').forEach(btn => {
    btn.addEventListener('click', () => {
      currentWallet = btn.dataset.wallet;
      document.querySelectorAll('.segmented button').forEach(b => b.classList.toggle('active', b === btn));
      expandedFriendKey = null;
      renderAll();
    });
  });
}

/* ---------- Tabs ---------- */
function bindTabs() {
  document.querySelectorAll('#tabRow button').forEach(btn => {
    btn.addEventListener('click', () => {
      currentTab = btn.dataset.tab;
      document.querySelectorAll('#tabRow button').forEach(b => b.classList.toggle('active', b === btn));
      document.getElementById('statusFilter').style.display = currentTab === 'owed' ? 'none' : 'inline-block';
      renderTabContent();
    });
  });
  document.getElementById('statusFilter').style.display = 'none';
}

function bindSearchFilters() {
  document.getElementById('searchInput').addEventListener('input', renderTabContent);
  document.getElementById('statusFilter').addEventListener('change', renderTabContent);
  document.getElementById('dateFilter').addEventListener('change', renderTabContent);
}

function withinDateFilter(dateStr) {
  const val = document.getElementById('dateFilter').value;
  if (val === 'all') return true;
  const days = parseInt(val, 10);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return new Date(dateStr) >= cutoff;
}

/* ---------- Render orchestration ---------- */
function renderAll() {
  renderStats();
  renderTabContent();
}

function renderStats() {
  const s = splitDashboardStats(currentWallet);
  document.getElementById('statTotalExpenses').textContent = fmt(s.totalExpenses, currentWallet);
  document.getElementById('statOutstanding').textContent = fmt(s.totalOutstanding, currentWallet);
  document.getElementById('statCollected').textContent = fmt(s.totalCollected, currentWallet);
  document.getElementById('statDebtors').textContent = s.activeDebtors;
  document.getElementById('statSettled').textContent = s.settledPayments;
  document.getElementById('statCount').textContent = s.expenseCount;
}

function renderTabContent() {
  const el = document.getElementById('tabContent');
  const query = document.getElementById('searchInput').value.trim().toLowerCase();
  if (currentTab === 'owed') el.innerHTML = renderOwedTab(query);
  else if (currentTab === 'expenses') el.innerHTML = renderExpensesTab(query);
  else el.innerHTML = renderPaymentsTab(query);

  if (currentTab === 'owed') bindOwedTabEvents();
}

/* ---------- Owed to Me tab ---------- */
function renderOwedTab(query) {
  let friends = getFriendBalances(currentWallet);
  const statusVal = document.getElementById('statusFilter').style.display === 'none' ? 'all' : document.getElementById('statusFilter').value;
  if (query) friends = friends.filter(f => f.name.toLowerCase().includes(query));
  if (statusVal === 'settled') friends = friends.filter(f => f.remaining <= 0);
  else if (statusVal === 'open') friends = friends.filter(f => f.remaining > 0);

  if (friends.length === 0) return '<div class="empty-state">No split balances yet. Tap + to create a split expense.</div>';

  return friends.map(f => {
    const key = f.name.toLowerCase() + '|' + f.wallet;
    const expanded = expandedFriendKey === key;
    const settled = f.remaining <= 0;
    return `
    <div class="friend-balance-card ${expanded ? 'expanded' : ''}" data-key="${key}" data-name="${escapeHtml(f.name)}" data-wallet="${f.wallet}">
      <div class="fb-top" data-toggle="${key}">
        <div class="fb-avatar">${initials(f.name)}</div>
        <div class="fb-mid">
          <div class="fb-name">${escapeHtml(f.name)}</div>
          <div class="fb-sub">${f.entries.length} split${f.entries.length > 1 ? 's' : ''} ${settled ? '<span class="fb-settled-tag">Settled</span>' : ''}</div>
        </div>
        <div class="fb-right">
          <div class="fb-amount" style="${settled ? 'color:var(--text-secondary);' : ''}">${fmt(f.remaining, f.wallet)}</div>
        </div>
        <svg class="fb-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg>
      </div>
      <div class="fb-detail">
        ${f.entries.map(e => `
          <div class="fb-entry">
            <span>${escapeHtml(e.splitTitle || 'Split')} · ${new Date(e.splitDate || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
            <b>${fmt(e.remaining, e.wallet)} / ${fmt(e.total, e.wallet)}</b>
          </div>
        `).join('')}
        ${!settled ? `
        <div class="fb-pay-row">
          <input type="number" inputmode="decimal" class="fb-pay-input" placeholder="Amount received">
          <button type="button" class="fb-pay-btn" data-name="${escapeHtml(f.name)}" data-wallet="${f.wallet}">Register Payment</button>
        </div>` : ''}
      </div>
    </div>`;
  }).join('');
}

function bindOwedTabEvents() {
  document.querySelectorAll('[data-toggle]').forEach(el => {
    el.addEventListener('click', () => {
      const key = el.dataset.toggle;
      expandedFriendKey = expandedFriendKey === key ? null : key;
      renderTabContent();
    });
  });
}

function bindFriendPayDelegation() {
  document.getElementById('tabContent').addEventListener('click', (e) => {
    const btn = e.target.closest('.fb-pay-btn');
    if (!btn) return;
    e.stopPropagation();
    const card = btn.closest('.friend-balance-card');
    const input = card.querySelector('.fb-pay-input');
    const amount = parseFloat(input.value);
    if (!amount || amount <= 0) { input.focus(); return; }
    try {
      registerFriendPayment(btn.dataset.name, btn.dataset.wallet, amount);
      showToast('Payment registered');
      renderAll();
    } catch (err) {
      alert(err.message);
    }
  });
}

/* ---------- Per-split PDF share/download (Expense History tab) ---------- */
function bindExpenseCardDelegation() {
  document.getElementById('tabContent').addEventListener('click', (e) => {
    const card = e.target.closest('.expense-card');
    if (!card) return;
    const downloadBtn = e.target.closest('.exp-download-btn');
    const shareBtn = e.target.closest('.exp-share-btn');
    if (!downloadBtn && !shareBtn) return;

    const split = getExpenseHistory(currentWallet).find(s => s.id === card.dataset.splitId);
    if (!split) return;

    if (downloadBtn && typeof downloadSplitPDF === 'function') downloadSplitPDF(split);
    if (shareBtn && typeof shareSplitPDF === 'function') shareSplitPDF(split);
  });
}

/* ---------- Export All (whole report) ---------- */
function bindExportAll() {
  const dlBtn = document.getElementById('downloadAllSplitsBtn');
  const shareBtn = document.getElementById('shareAllSplitsBtn');
  if (dlBtn) dlBtn.addEventListener('click', () => {
    if (typeof downloadAllSplitsPDF === 'function') downloadAllSplitsPDF(currentWallet);
  });
  if (shareBtn) shareBtn.addEventListener('click', () => {
    if (typeof shareAllSplitsPDF === 'function') shareAllSplitsPDF(currentWallet);
  });
}

/* ---------- Expense History tab ---------- */
function renderExpensesTab(query) {
  let expenses = getExpenseHistory(currentWallet);
  const statusVal = document.getElementById('statusFilter').value;
  if (query) expenses = expenses.filter(e => e.title.toLowerCase().includes(query) || e.friends.some(f => f.name.toLowerCase().includes(query)));
  if (statusVal !== 'all') expenses = expenses.filter(e => e.status === statusVal);
  expenses = expenses.filter(e => withinDateFilter(e.date));

  if (expenses.length === 0) return '<div class="empty-state">No expenses match your filters.</div>';

  return expenses.map(e => `
    <div class="expense-card" data-split-id="${e.id}">
      <div class="exp-head">
        <div>
          <div class="exp-title">${escapeHtml(e.title)}</div>
          <div class="exp-date">${new Date(e.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
        </div>
        <div class="exp-status ${e.status}">${e.status === 'settled' ? 'Settled' : e.status === 'partial' ? 'Partial' : 'Open'}</div>
      </div>
      <div class="exp-total">${fmt(e.totalAmount, e.wallet)}</div>
      <div class="exp-friends">
        ${e.friends.map(f => `<span class="exp-friend-chip">${escapeHtml(f.name)} · ${fmt(f.share, e.wallet)}</span>`).join('')}
      </div>
      <div class="exp-figures"><span>Collected</span><b style="color:var(--positive);">${fmt(e.collected, e.wallet)}</b></div>
      <div class="exp-figures"><span>Outstanding</span><b style="color:var(--negative);">${fmt(e.outstanding, e.wallet)}</b></div>
      <div class="budget-track"><div class="budget-fill ${e.progress >= 100 ? 'ok' : e.progress > 0 ? 'warn' : 'over'}" style="width:${e.progress}%"></div></div>
      <div style="text-align:right;font-size:11px;color:var(--text-secondary);margin-top:6px;">${e.progress}% collected</div>
      <div style="display:flex; gap:8px; margin-top:12px;">
        <button type="button" class="export-btn secondary exp-download-btn" style="padding:9px;font-size:12px;">⬇️ Download</button>
        <button type="button" class="export-btn primary exp-share-btn" style="padding:9px;font-size:12px;">📤 Share</button>
      </div>
    </div>`).join('');
}

/* ---------- Payment History tab ---------- */
function renderPaymentsTab(query) {
  let rows = getPaymentHistory(currentWallet);
  if (query) rows = rows.filter(r => r.friend.toLowerCase().includes(query) || (r.splitTitle || '').toLowerCase().includes(query));
  rows = rows.filter(r => withinDateFilter(r.date));

  const statusVal = document.getElementById('statusFilter').value;
  if (statusVal !== 'all') {
    // status filter here reads against the debt's current status, approximate via remaining balance snapshot not stored per-payment;
    // so only "settled"/"open" filters are meaningful across the aggregate list — skip mismatch rows gracefully.
  }

  if (rows.length === 0) return '<div class="empty-state">No payments logged yet.</div>';

  return `<div class="card">` + rows.map(r => `
    <div class="ph-item">
      <div class="ph-left">
        <div class="ph-name">${escapeHtml(r.friend)}</div>
        <div class="ph-sub">${escapeHtml(r.splitTitle || 'Split expense')}</div>
      </div>
      <div class="ph-right">
        <div class="ph-amount">+${fmt(r.amount, r.currency)}</div>
        <div class="ph-date">${new Date(r.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
      </div>
    </div>
  `).join('') + `</div>`;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

/* ---------- New Split form ---------- */
let newSplitWallet = 'aed';

function addFriendRow(value) {
  friendRowCount++;
  const wrap = document.getElementById('friendRows');
  const row = document.createElement('div');
  row.className = 'friend-input-row';
  row.innerHTML = `
    <input type="text" class="friend-name-input" placeholder="Friend's name" value="${value ? escapeHtml(value) : ''}">
    <button type="button" class="friend-remove-btn" aria-label="Remove">✕</button>
  `;
  row.querySelector('.friend-remove-btn').addEventListener('click', () => {
    row.remove();
    updateSplitPreview();
  });
  row.querySelector('.friend-name-input').addEventListener('input', updateSplitPreview);
  wrap.appendChild(row);
}

function updateSplitPreview() {
  const total = parseFloat(document.getElementById('splitAmount').value) || 0;
  const names = Array.from(document.querySelectorAll('.friend-name-input')).map(i => i.value.trim()).filter(Boolean);
  const preview = document.getElementById('splitPreview');

  if (names.length === 0 || total <= 0) {
    preview.innerHTML = '<div style="font-size:12.5px;color:var(--text-secondary);">Enter a total amount and at least one friend to see the split.</div>';
    return;
  }

  const shares = computeEqualShares(total, names.length);
  preview.innerHTML = names.map((n, i) => `
    <div class="split-preview-row"><span>${escapeHtml(n)}</span><b>${fmt(shares[i], newSplitWallet)}</b></div>
  `).join('') + `<div class="split-preview-row" style="color:var(--text-secondary);"><span>Total</span><b>${fmt(total, newSplitWallet)}</b></div>`;
}

function resetSplitForm() {
  document.getElementById('splitTitle').value = '';
  document.getElementById('splitAmount').value = '';
  document.getElementById('splitNotes').value = '';
  document.getElementById('splitDate').value = new Date().toISOString().slice(0, 10);
  document.getElementById('friendRows').innerHTML = '';
  friendRowCount = 0;
  addFriendRow(); addFriendRow();
  newSplitWallet = 'aed';
  document.querySelectorAll('#splitWalletToggle button').forEach(b => b.classList.toggle('active', b.dataset.wallet === 'aed'));
  updateSplitPreview();
}

function bindNewSplitForm() {
  const form = document.getElementById('newSplitForm');

  document.getElementById('newSplitBtn').addEventListener('click', () => {
    resetSplitForm();
    form.classList.add('open');
  });
  document.getElementById('splitFormClose').addEventListener('click', () => form.classList.remove('open'));

  document.getElementById('addFriendBtn').addEventListener('click', () => { addFriendRow(); updateSplitPreview(); });
  document.getElementById('splitAmount').addEventListener('input', updateSplitPreview);

  document.querySelectorAll('#splitWalletToggle button').forEach(btn => {
    btn.addEventListener('click', () => {
      newSplitWallet = btn.dataset.wallet;
      document.querySelectorAll('#splitWalletToggle button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateSplitPreview();
    });
  });

  document.getElementById('saveSplitBtn').addEventListener('click', () => {
    const title = document.getElementById('splitTitle').value.trim();
    const total = parseFloat(document.getElementById('splitAmount').value);
    const names = Array.from(document.querySelectorAll('.friend-name-input')).map(i => i.value.trim()).filter(Boolean);

    if (!title) { document.getElementById('splitTitle').focus(); return; }
    if (!total || total <= 0) { document.getElementById('splitAmount').focus(); return; }
    if (names.length === 0) { alert('Add at least one friend to split with.'); return; }

    try {
      createSplit({
        title,
        totalAmount: total,
        wallet: newSplitWallet,
        date: document.getElementById('splitDate').value,
        friendNames: names,
        notes: document.getElementById('splitNotes').value
      });
      form.classList.remove('open');
      showToast('Split expense saved');
      if (currentWallet === newSplitWallet) renderAll();
      else renderStats();
      if (typeof syncNow === 'function') syncNow();
    } catch (err) {
      alert(err.message);
    }
  });
}
