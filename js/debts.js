/* ============================================================
   FinTrack — Debts Module
   ============================================================ */

const DEBT_STORE_KEY = 'ft_debts';

const DEFAULT_DEBTS = [];

let currentDirection = 'i_owe';
let openDebtId = null;
let newDebtWallet = 'aed';
let paymentWallet = 'aed';

function getDebts() {
  const raw = localStorage.getItem(DEBT_STORE_KEY);
  if (!raw) {
    localStorage.setItem(DEBT_STORE_KEY, JSON.stringify(DEFAULT_DEBTS));
    return DEFAULT_DEBTS;
  }
  return JSON.parse(raw);
}
function saveDebts(debts) { localStorage.setItem(DEBT_STORE_KEY, JSON.stringify(debts)); }

function initials(name) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

function statusOf(d) {
  if (d.remaining <= 0) return 'settled';
  if (d.due && new Date(d.due) < new Date()) return 'overdue';
  if (d.remaining < d.total) return 'partially_paid';
  return 'open';
}

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('view') === 'receive') currentDirection = 'owed_to_me';

  renderAll();
  bindDrawer();
  bindToggle();
  bindAddForm();
  bindDetail();
});

function renderAll() {
  renderSummary();
  renderList();
  document.querySelectorAll('#directionToggle button').forEach(b =>
    b.classList.toggle('active', b.dataset.dir === currentDirection));
  document.getElementById('drawerOwe').classList.toggle('active', currentDirection === 'i_owe');
  document.getElementById('drawerReceive').classList.toggle('active', currentDirection === 'owed_to_me');
}

function renderSummary() {
  const debts = getDebts();
  const oweAed = debts.filter(d => d.direction === 'i_owe' && d.wallet === 'aed').reduce((s, d) => s + d.remaining, 0);
  const oweInr = debts.filter(d => d.direction === 'i_owe' && d.wallet === 'inr').reduce((s, d) => s + d.remaining, 0);
  const oweCount = debts.filter(d => d.direction === 'i_owe' && d.remaining > 0).length;
  const recvAed = debts.filter(d => d.direction === 'owed_to_me' && d.wallet === 'aed').reduce((s, d) => s + d.remaining, 0);
  const recvInr = debts.filter(d => d.direction === 'owed_to_me' && d.wallet === 'inr').reduce((s, d) => s + d.remaining, 0);
  const recvCount = debts.filter(d => d.direction === 'owed_to_me' && d.remaining > 0).length;

  document.getElementById('sumOweAed').textContent = 'AED ' + oweAed.toLocaleString('en-IN');
  document.getElementById('sumOweInr').textContent = '₹' + oweInr.toLocaleString('en-IN');
  document.getElementById('sumOweSub').textContent = oweCount + ' people';
  document.getElementById('sumReceiveAed').textContent = 'AED ' + recvAed.toLocaleString('en-IN');
  document.getElementById('sumReceiveInr').textContent = '₹' + recvInr.toLocaleString('en-IN');
  document.getElementById('sumReceiveSub').textContent = recvCount + ' people';
}

function renderList() {
  const debts = getDebts().filter(d => d.direction === currentDirection);
  const listEl = document.getElementById('debtList');

  if (debts.length === 0) {
    listEl.innerHTML = `<div class="empty-state">No ${currentDirection === 'i_owe' ? 'debts owed' : 'money to collect'} right now.</div>`;
    return;
  }

  // sort: overdue/high priority first
  debts.sort((a, b) => {
    const order = { overdue: 0, open: 1, partially_paid: 2, settled: 3 };
    return order[statusOf(a)] - order[statusOf(b)];
  });

  listEl.innerHTML = debts.map(d => {
    const status = statusOf(d);
    const sym = d.wallet === 'aed' ? 'AED ' : '₹';
    return `
      <div class="debt-list-card" data-id="${d.id}">
        <div class="debt-avatar">${initials(d.person)}</div>
        <div class="debt-mid">
          <div class="dm-name"><span class="priority-dot ${d.priority}"></span>${d.person}</div>
          <div class="dm-sub">${d.due ? 'Due ' + new Date(d.due).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'No due date'}</div>
        </div>
        <div class="debt-right">
          <div class="dr-amount">${sym}${d.remaining.toLocaleString('en-IN')}</div>
          <div class="dr-status ${status}">${status.replace('_', ' ')}</div>
        </div>
      </div>
    `;
  }).join('');

  listEl.querySelectorAll('.debt-list-card').forEach(card => {
    card.addEventListener('click', () => openDetail(parseInt(card.dataset.id)));
  });
}

function bindToggle() {
  document.querySelectorAll('#directionToggle button').forEach(btn => {
    btn.addEventListener('click', () => {
      currentDirection = btn.dataset.dir;
      renderAll();
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

let editingDebtId = null;

/* ---------- Add / Edit debt ---------- */
function bindAddForm() {
  const form = document.getElementById('addDebtForm');
  document.getElementById('addDebtBtn').addEventListener('click', () => {
    editingDebtId = null;
    document.getElementById('debtFormTitle').textContent = 'Add Debt';
    document.getElementById('saveDebtBtn').textContent = 'Save Debt';
    document.getElementById('deleteDebtBtn').style.display = 'none';
    ['newPerson', 'newPhone', 'newAmount', 'newDue', 'newNotes'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('newDirection').value = currentDirection;
    document.getElementById('newPriority').value = 'normal';
    newDebtWallet = 'aed';
    document.querySelectorAll('#newWalletToggle button').forEach(b => b.classList.toggle('active', b.dataset.wallet === 'aed'));
    form.classList.add('open');
  });
  document.getElementById('addFormClose').addEventListener('click', () => form.classList.remove('open'));

  document.querySelectorAll('#newWalletToggle button').forEach(btn => {
    btn.addEventListener('click', () => {
      newDebtWallet = btn.dataset.wallet;
      document.querySelectorAll('#newWalletToggle button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  document.getElementById('saveDebtBtn').addEventListener('click', () => {
    const person = document.getElementById('newPerson').value.trim();
    const total = parseFloat(document.getElementById('newAmount').value);
    if (!person) { document.getElementById('newPerson').focus(); return; }
    if (!total || total <= 0) { document.getElementById('newAmount').focus(); return; }

    const debts = getDebts();

    if (editingDebtId) {
      const idx = debts.findIndex(d => d.id === editingDebtId);
      if (idx === -1) return;
      const old = debts[idx];
      const alreadyPaid = old.total - old.remaining;
      // Preserve what's already been paid; only the outstanding portion changes with the new total
      const newRemaining = Math.max(0, total - alreadyPaid);
      debts[idx] = {
        ...old,
        direction: document.getElementById('newDirection').value,
        person,
        phone: document.getElementById('newPhone').value.trim(),
        wallet: newDebtWallet,
        total,
        remaining: newRemaining,
        due: document.getElementById('newDue').value,
        priority: document.getElementById('newPriority').value,
        notes: document.getElementById('newNotes').value.trim(),
        synced: false
      };
    } else {
      debts.push({
        id: Date.now(),
        direction: document.getElementById('newDirection').value,
        person,
        phone: document.getElementById('newPhone').value.trim(),
        wallet: newDebtWallet,
        total,
        remaining: total,
        due: document.getElementById('newDue').value,
        priority: document.getElementById('newPriority').value,
        notes: document.getElementById('newNotes').value.trim(),
        payments: []
      });
    }

    saveDebts(debts);

    form.classList.remove('open');
    ['newPerson', 'newPhone', 'newAmount', 'newDue', 'newNotes'].forEach(id => document.getElementById(id).value = '');
    renderAll();
    if (typeof syncNow === 'function') syncNow();
  });

  document.getElementById('deleteDebtBtn').addEventListener('click', () => {
    if (!editingDebtId) return;
    if (!confirm('Delete this debt? This cannot be undone.')) return;

    const debts = getDebts().filter(d => d.id !== editingDebtId);
    saveDebts(debts);

    form.classList.remove('open');
    editingDebtId = null;
    renderAll();
    if (typeof syncNow === 'function') syncNow();
  });
}

function openEditDebt(id) {
  const d = getDebts().find(x => x.id === id);
  if (!d) return;

  editingDebtId = id;
  document.getElementById('debtFormTitle').textContent = 'Edit Debt';
  document.getElementById('saveDebtBtn').textContent = 'Update Debt';
  document.getElementById('deleteDebtBtn').style.display = 'block';

  document.getElementById('newDirection').value = d.direction;
  document.getElementById('newPerson').value = d.person;
  document.getElementById('newAmount').value = d.total;
  document.getElementById('newDue').value = d.due || '';
  document.getElementById('newPriority').value = d.priority;
  document.getElementById('newPhone').value = d.phone || '';
  document.getElementById('newNotes').value = d.notes || '';

  newDebtWallet = d.wallet;
  document.querySelectorAll('#newWalletToggle button').forEach(b => b.classList.toggle('active', b.dataset.wallet === d.wallet));

  document.getElementById('debtDetail').classList.remove('open');
  document.getElementById('addDebtForm').classList.add('open');
}

/* ---------- Debt detail + payments ---------- */
function openDetail(id) {
  openDebtId = id;
  const d = getDebts().find(x => x.id === id);
  if (!d) return;

  const sym = d.wallet === 'aed' ? 'AED ' : '₹';
  document.getElementById('detailAvatar').textContent = initials(d.person);
  document.getElementById('detailName').textContent = d.person;
  document.getElementById('detailSub').textContent =
    (d.direction === 'i_owe' ? 'You owe' : 'Owes you') + (d.due ? ' · Due ' + new Date(d.due).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
  document.getElementById('detailRemaining').textContent = sym + d.remaining.toLocaleString('en-IN');
  document.getElementById('detailTotal').textContent = sym + d.total.toLocaleString('en-IN');
  const pct = Math.round(((d.total - d.remaining) / d.total) * 100);
  document.getElementById('detailProgressFill').style.width = pct + '%';
  document.getElementById('detailPct').textContent = pct + '% paid';

  renderPaymentHistory(d);

  // Default the payment currency toggle to this debt's own currency
  paymentWallet = d.wallet;
  document.querySelectorAll('#paymentWalletToggle button').forEach(b =>
    b.classList.toggle('active', b.dataset.wallet === d.wallet));

  document.getElementById('debtDetail').classList.add('open');
}

function renderPaymentHistory(d) {
  const el = document.getElementById('paymentHistory');
  if (!d.payments || d.payments.length === 0) {
    el.innerHTML = '<div class="empty-state">No payments logged yet.</div>';
    return;
  }
  el.innerHTML = d.payments.slice().reverse().map(p => {
    const sym = (p.currency || d.wallet) === 'aed' ? 'AED ' : '₹';
    return `
    <div class="payment-item">
      <div>
        <div class="p-date">${new Date(p.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
        ${p.notes ? `<div class="p-notes">${p.notes}</div>` : ''}
      </div>
      <div class="p-amount">+${sym}${p.amount.toLocaleString('en-IN')}</div>
    </div>
  `;
  }).join('');
}

function bindDetail() {
  document.getElementById('detailClose').addEventListener('click', () => {
    document.getElementById('debtDetail').classList.remove('open');
    openDebtId = null;
  });

  document.getElementById('editDebtBtn').addEventListener('click', () => {
    if (openDebtId) openEditDebt(openDebtId);
  });

  document.querySelectorAll('#paymentWalletToggle button').forEach(btn => {
    btn.addEventListener('click', () => {
      paymentWallet = btn.dataset.wallet;
      document.querySelectorAll('#paymentWalletToggle button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  document.getElementById('logPaymentBtn').addEventListener('click', () => {
    const amount = parseFloat(document.getElementById('paymentAmountInput').value);
    if (!amount || amount <= 0 || !openDebtId) return;

    const debts = getDebts();
    const d = debts.find(x => x.id === openDebtId);
    if (!d) return;

    const applied = Math.min(amount, d.remaining);
    d.remaining -= applied;
    d.payments.push({ amount: applied, currency: paymentWallet, date: new Date().toISOString(), notes: '' });

    saveDebts(debts);
    document.getElementById('paymentAmountInput').value = '';
    openDetail(openDebtId);
    renderAll();
    if (typeof syncNow === 'function') syncNow();
  });
}
