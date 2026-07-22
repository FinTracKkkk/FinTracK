/* ============================================================
   FinTrack — Analytics Logic
   ============================================================ */

let currentPeriod = 'monthly';
let currentWallet = 'aed';

document.addEventListener('DOMContentLoaded', () => {
  bindDrawer();
  bindFilters();
  render();
});

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

function bindFilters() {
  document.querySelectorAll('.period-row button').forEach(btn => {
    btn.addEventListener('click', () => {
      currentPeriod = btn.dataset.period;
      document.querySelectorAll('.period-row button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      render();
    });
  });
  document.querySelectorAll('.segmented button').forEach(btn => {
    btn.addEventListener('click', () => {
      currentWallet = btn.dataset.wallet;
      document.querySelectorAll('.segmented button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      render();
    });
  });
}

function fmt(amount) {
  const sym = currentWallet === 'aed' ? 'AED ' : '₹';
  return sym + Math.abs(amount).toLocaleString('en-IN');
}

function render() {
  const data = getAnalytics(currentPeriod, currentWallet);
  renderIncomeExpense(data);
  renderCashflow(data);
  renderCategories(data);
}

function renderIncomeExpense(data) {
  document.getElementById('incomeAmt').textContent = fmt(data.income);
  document.getElementById('expenseAmt').textContent = fmt(data.expense);

  const total = data.income + data.expense || 1;
  document.getElementById('barIncome').style.width = (data.income / total * 100) + '%';
  document.getElementById('barExpense').style.width = (data.expense / total * 100) + '%';

  const netEl = document.getElementById('netAmount');
  netEl.textContent = (data.net >= 0 ? '+' : '−') + fmt(data.net);
  netEl.className = 'net-amount ' + (data.net >= 0 ? 'positive' : 'negative');
}

function renderCashflow(data) {
  const maxAbs = Math.max(...data.cashflow.map(c => Math.abs(c.net)), 1);
  const el = document.getElementById('cashflowChart');
  el.innerHTML = data.cashflow.map(c => {
    const heightPct = Math.max(6, Math.round((Math.abs(c.net) / maxAbs) * 100));
    const cls = c.net >= 0 ? 'positive' : 'negative';
    return `
      <div class="cf-col">
        <div class="cf-bar-wrap">
          <div class="cf-bar ${cls}" style="height:${heightPct}%"></div>
        </div>
        <div class="cf-label">${c.label}</div>
      </div>
    `;
  }).join('');
}

function renderCategories(data) {
  const donutEl = document.getElementById('catDonut');
  const listEl = document.getElementById('catDetailList');

  if (data.categories.length === 0) {
    donutEl.style.background = 'var(--bg-elevated)';
    listEl.innerHTML = '<div class="empty-state" style="padding:0;">No expenses in this period yet.</div>';
    return;
  }

  let deg = 0;
  const stops = data.categories.map(c => {
    const start = deg;
    deg += c.pct * 3.6;
    return `${c.color} ${start}deg ${deg}deg`;
  }).join(', ');
  donutEl.style.background = `conic-gradient(${stops})`;

  listEl.innerHTML = data.categories
    .slice().sort((a, b) => b.amount - a.amount)
    .map(c => `
      <div class="cat-detail-item">
        <span class="legend-dot" style="background:${c.color}"></span>
        <span class="cd-name">${c.name}</span>
        <span class="cd-amount">${fmt(c.amount)}</span>
        <span class="cd-pct">${c.pct}%</span>
      </div>
    `).join('');
}
