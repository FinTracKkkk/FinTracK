/* ============================================================
   FinTrack — Dashboard rendering
   ============================================================ */

let activeWallet = 'aed'; // controls Today/Month stat + donut context

document.addEventListener('DOMContentLoaded', () => {
  initWalletStore({ aed: MOCK.wallets.aed.balance, inr: MOCK.wallets.inr.balance });
  renderWalletCards();
  renderStats();
  renderDebts();
  renderBudgets();
  renderGoals();
  renderDonut();
  renderTransactions();
  bindSegmented();
  bindDrawer();
});

function fmt(amount, currency) {
  const symbol = currency === 'AED' ? 'AED ' : '₹';
  const abs = Math.abs(amount);
  return symbol + abs.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function renderWalletCards() {
  const el = document.getElementById('walletRow');
  const w = MOCK.wallets;
  const aedBal = getWalletBalance('aed');
  const inrBal = getWalletBalance('inr');
  const aedTrend = computeMonthlyTrend('aed', aedBal);
  const inrTrend = computeMonthlyTrend('inr', inrBal);
  el.innerHTML = `
    <div class="wallet-card">
      <div class="w-label">${w.aed.name}</div>
      <div class="w-amount"><span class="cur">AED</span>${aedBal.toLocaleString('en-IN')}</div>
      <div class="w-trend ${aedTrend >= 0 ? 'up' : 'down'}">${aedTrend >= 0 ? '▲' : '▼'} ${Math.abs(aedTrend)}% this month</div>
    </div>
    <div class="wallet-card">
      <div class="w-label">${w.inr.name}</div>
      <div class="w-amount"><span class="cur">₹</span>${inrBal.toLocaleString('en-IN')}</div>
      <div class="w-trend ${inrTrend >= 0 ? 'up' : 'down'}">${inrTrend >= 0 ? '▲' : '▼'} ${Math.abs(inrTrend)}% this month</div>
    </div>
  `;
}

// Trend = this month's net (income - expense) as a % of the balance before that net was applied.
// A live, honest substitute for a hardcoded number — grows/shrinks as you actually log transactions.
function computeMonthlyTrend(wallet, currentBalance) {
  const now = new Date();
  let net = 0;
  getTransactions().forEach(t => {
    if (t.wallet !== wallet) return;
    const d = new Date(t.date);
    if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) net += t.amount;
  });
  const startOfMonthBalance = currentBalance - net;
  if (startOfMonthBalance <= 0) return net === 0 ? 0 : 100;
  return Math.round((net / startOfMonthBalance) * 1000) / 10;
}

function renderStats() {
  const cur = activeWallet === 'aed' ? 'AED' : 'INR';
  const now = new Date();
  let today = 0, month = 0;

  getTransactions().forEach(t => {
    if (t.wallet !== activeWallet || t.type !== 'expense') return;
    const d = new Date(t.date);
    if (d.toDateString() === now.toDateString()) today += Math.abs(t.amount);
    if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) month += Math.abs(t.amount);
  });

  document.getElementById('todayAmt').textContent = fmt(today, cur);
  document.getElementById('monthAmt').textContent = fmt(month, cur);
}

function renderDebts() {
  const raw = localStorage.getItem('ft_debts');
  const debts = raw ? JSON.parse(raw) : [];

  const oweAed = debts.filter(d => d.direction === 'i_owe' && d.wallet === 'aed').reduce((s, d) => s + d.remaining, 0);
  const oweInr = debts.filter(d => d.direction === 'i_owe' && d.wallet === 'inr').reduce((s, d) => s + d.remaining, 0);
  const oweCount = debts.filter(d => d.direction === 'i_owe' && d.remaining > 0).length;
  const recvAed = debts.filter(d => d.direction === 'owed_to_me' && d.wallet === 'aed').reduce((s, d) => s + d.remaining, 0);
  const recvInr = debts.filter(d => d.direction === 'owed_to_me' && d.wallet === 'inr').reduce((s, d) => s + d.remaining, 0);
  const recvCount = debts.filter(d => d.direction === 'owed_to_me' && d.remaining > 0).length;

  document.getElementById('debtOwe').innerHTML = `AED ${oweAed.toLocaleString('en-IN')}` + (oweInr ? `<br><span style="font-size:12px;">₹${oweInr.toLocaleString('en-IN')}</span>` : '');
  document.getElementById('debtOweSub').textContent = `${oweCount} people`;
  document.getElementById('debtReceive').innerHTML = `AED ${recvAed.toLocaleString('en-IN')}` + (recvInr ? `<br><span style="font-size:12px;">₹${recvInr.toLocaleString('en-IN')}</span>` : '');
  document.getElementById('debtReceiveSub').textContent = `${recvCount} people`;
}

function renderBudgets() {
  const el = document.getElementById('budgetList');
  const budgets = getBudgets();

  if (budgets.length === 0) {
    el.innerHTML = '<div class="empty-state">No budgets set yet — <a href="budgets.html" style="color:var(--gold);">create one</a>.</div>';
    return;
  }

  const now = new Date();
  el.innerHTML = budgets.map(b => {
    let spent = 0;
    getTransactions().forEach(t => {
      if (t.wallet !== b.wallet || t.type !== 'expense' || t.category !== b.category) return;
      const d = new Date(t.date);
      if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) spent += Math.abs(t.amount);
    });
    spent = Math.round(spent);
    const pct = Math.min(100, Math.round((spent / b.limit) * 100));
    let cls = 'ok';
    if (pct >= 100) cls = 'over';
    else if (pct >= 80) cls = 'warn';
    const sym = b.wallet === 'aed' ? 'AED ' : '₹';
    return `
      <div class="budget-item">
        <div class="budget-head">
          <span class="b-name">${b.category}</span>
          <span class="b-figures">${sym}${spent} / ${b.limit}</span>
        </div>
        <div class="budget-track"><div class="budget-fill ${cls}" style="width:${pct}%"></div></div>
      </div>
    `;
  }).join('');
}

function renderGoals() {
  const el = document.getElementById('goalList');
  const goals = getGoals();

  if (goals.length === 0) {
    el.innerHTML = '<div class="empty-state">No savings goals yet — set one in Savings Goals.</div>';
    return;
  }

  el.innerHTML = goals.map(g => {
    const pct = Math.round((g.current / g.target) * 100);
    const sym = g.wallet === 'aed' ? 'AED ' : '₹';
    return `
      <div class="goal-card">
        <div class="goal-ring" style="background:conic-gradient(var(--gold) ${pct * 3.6}deg, var(--bg-elevated) 0deg)">
          <div style="background:var(--navy-soft);width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;">${pct}%</div>
        </div>
        <div class="goal-info">
          <div class="g-name">${g.name}</div>
          <div class="g-sub">${sym}${g.current.toLocaleString('en-IN')} of ${sym}${g.target.toLocaleString('en-IN')}</div>
        </div>
      </div>
    `;
  }).join('');
}

function renderDonut() {
  const now = new Date();
  const spentByCategory = {};
  let totalExpense = 0;

  getTransactions().forEach(t => {
    if (t.wallet !== activeWallet || t.type !== 'expense') return;
    const d = new Date(t.date);
    if (d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth()) return;
    spentByCategory[t.category] = (spentByCategory[t.category] || 0) + Math.abs(t.amount);
    totalExpense += Math.abs(t.amount);
  });

  const donutEl = document.getElementById('donut');
  const legendEl = document.getElementById('legend');

  if (totalExpense === 0) {
    donutEl.style.background = 'var(--bg-elevated)';
    legendEl.innerHTML = '<div class="empty-state" style="padding:0;">No expenses logged this month yet.</div>';
    return;
  }

  const cats = Object.keys(spentByCategory)
    .map(name => ({ name, amount: spentByCategory[name], pct: Math.round((spentByCategory[name] / totalExpense) * 100), color: CATEGORY_COLOR_MAP[name] || '#9AA3B2' }))
    .sort((a, b) => b.amount - a.amount);

  let deg = 0;
  const stops = cats.map(c => {
    const start = deg;
    deg += c.pct * 3.6;
    return `${c.color} ${start}deg ${deg}deg`;
  }).join(', ');
  donutEl.style.background = `conic-gradient(${stops})`;

  legendEl.innerHTML = cats.map(c => `
    <div class="legend-item">
      <span class="legend-dot" style="background:${c.color}"></span>
      <span class="l-name">${c.name}</span>
      <span class="l-pct">${c.pct}%</span>
    </div>
  `).join('');
}

function renderTransactions() {
  const el = document.getElementById('txList');
  const txs = getTransactions().slice(0, 8);

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
      <div class="tx-amount ${t.type}">${t.amount < 0 ? '−' : '+'}${fmt(Math.abs(t.amount), t.currency)}</div>
    </div>
  `).join('');

  el.querySelectorAll('.tx-item').forEach(item => {
    item.addEventListener('click', () => {
      if (typeof openSheetForEdit === 'function') openSheetForEdit(item.dataset.id);
    });
  });
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

function bindSegmented() {
  document.querySelectorAll('.segmented button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.segmented button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeWallet = btn.dataset.wallet;
      renderStats();
      renderDonut();
    });
  });
}

function bindDrawer() {
  const drawer = document.getElementById('drawer');
  const backdrop = document.getElementById('drawerBackdrop');
  document.getElementById('menuBtn').addEventListener('click', () => {
    drawer.classList.add('open');
    backdrop.classList.add('open');
  });
  backdrop.addEventListener('click', closeDrawer);
  function closeDrawer() {
    drawer.classList.remove('open');
    backdrop.classList.remove('open');
  }
  window.closeDrawer = closeDrawer;
}


