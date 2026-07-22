/* ============================================================
   FinTrack — Alerts
   Priority Alerts: overdue debts, high-priority debts due soon,
   budget exceeded/near limit, large expenses.
   No AI involved — pure rule-based checks against your data.
   ============================================================ */

// Fallback debts (used only if debts.html hasn't been visited yet, so localStorage has no ft_debts key)
const ALERTS_FALLBACK_DEBTS = [];

function getDebtsForAlerts() {
  const raw = localStorage.getItem('ft_debts');
  return raw ? JSON.parse(raw) : ALERTS_FALLBACK_DEBTS;
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function computeAlerts() {
  const alerts = [];

  // Debts: overdue + due soon (high priority)
  getDebtsForAlerts().forEach(d => {
    if (d.remaining <= 0 || !d.due) return;
    const days = daysUntil(d.due);
    const sym = d.wallet === 'aed' ? 'AED ' : '₹';
    const verb = d.direction === 'i_owe' ? 'You owe' : 'Owed by';
    if (days < 0) {
      alerts.push({ level: 'red', text: `${verb} ${d.person} — ${sym}${d.remaining.toLocaleString('en-IN')} is overdue.` });
    } else if (days <= 7 && d.priority === 'high') {
      alerts.push({ level: 'orange', text: `${verb} ${d.person} — ${sym}${d.remaining.toLocaleString('en-IN')} due in ${days} day${days === 1 ? '' : 's'}.` });
    }
  });

  // Budgets — computed from real transactions against your saved budgets
  if (typeof getBudgets === 'function' && typeof getTransactions === 'function') {
    const now = new Date();
    getBudgets().forEach(b => {
      let spent = 0;
      getTransactions().forEach(t => {
        if (t.wallet !== b.wallet || t.type !== 'expense' || t.category !== b.category) return;
        const d = new Date(t.date);
        if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) spent += Math.abs(t.amount);
      });
      spent = Math.round(spent);
      const pct = (spent / b.limit) * 100;
      const sym = b.wallet === 'aed' ? 'AED ' : '₹';
      if (pct >= 100) {
        alerts.push({ level: 'red', text: `${b.category} budget exceeded — ${sym}${spent} of ${b.limit}.` });
      } else if (pct >= 80) {
        alerts.push({ level: 'orange', text: `${b.category} is at ${Math.round(pct)}% of its budget.` });
      }
    });
  }

  // Large single expense today
  const todayTotal = typeof getTransactions === 'function'
    ? getTransactions().filter(t => t.wallet === 'aed' && t.type === 'expense' && new Date(t.date).toDateString() === new Date().toDateString())
        .reduce((s, t) => s + Math.abs(t.amount), 0)
    : 0;
  if (todayTotal >= 500) {
    alerts.push({ level: 'orange', text: `Today's spending is already AED ${Math.round(todayTotal)} — higher than usual.` });
  }

  return alerts;
}

document.addEventListener('DOMContentLoaded', () => {
  const alerts = computeAlerts();
  renderBellBadge(alerts);
  renderAlertPanel(alerts);
  bindBell();
  maybeShowToast(alerts);
});

function renderBellBadge(alerts) {
  const badge = document.getElementById('bellBadge');
  if (alerts.length > 0) {
    badge.textContent = alerts.length;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

function renderAlertPanel(alerts) {
  const el = document.getElementById('alertList');
  if (alerts.length === 0) {
    el.innerHTML = '<div class="alert-empty">No alerts right now — you\'re on top of things.</div>';
    return;
  }
  const order = { red: 0, orange: 1, green: 2 };
  alerts.sort((a, b) => order[a.level] - order[b.level]);
  el.innerHTML = alerts.map(a => `
    <div class="alert-item">
      <span class="alert-dot ${a.level}"></span>
      <span class="alert-text">${a.text}</span>
    </div>
  `).join('');
}

function bindBell() {
  const panel = document.getElementById('alertPanel');
  const backdrop = document.getElementById('alertPanelBackdrop');
  document.getElementById('bellBtn').addEventListener('click', () => {
    panel.classList.toggle('open');
    backdrop.classList.toggle('open');
  });
  backdrop.addEventListener('click', () => {
    panel.classList.remove('open');
    backdrop.classList.remove('open');
  });
}

function maybeShowToast(alerts) {
  const redAlerts = alerts.filter(a => a.level === 'red');
  if (redAlerts.length === 0) return;

  const toast = document.getElementById('alertToast');
  toast.querySelector('.at-text').textContent =
    redAlerts.length === 1 ? redAlerts[0].text : `${redAlerts.length} urgent alerts need your attention.`;
  setTimeout(() => toast.classList.add('show'), 400);
  setTimeout(() => toast.classList.remove('show'), 4500);
}
