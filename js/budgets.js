/* ============================================================
   FinTrack — Budgets Logic
   ============================================================ */

let editingBudgetId = null;

document.addEventListener('DOMContentLoaded', () => {
  renderBudgetsList();
  bindDrawer();
  bindForm();
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

function spentForBudget(b) {
  const now = new Date();
  let spent = 0;
  getTransactions().forEach(t => {
    if (t.wallet !== b.wallet || t.type !== 'expense' || t.category !== b.category) return;
    const d = new Date(t.date);
    if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) spent += Math.abs(t.amount);
  });
  return Math.round(spent);
}

function renderBudgetsList() {
  const budgets = getBudgets();
  const el = document.getElementById('budgetsList');

  if (budgets.length === 0) {
    el.innerHTML = '<div class="empty-state">No budgets set yet. Tap + to create one.</div>';
    return;
  }

  el.innerHTML = budgets.map(b => {
    const sym = b.wallet === 'aed' ? 'AED ' : '₹';
    const spent = spentForBudget(b);
    const pct = Math.min(100, Math.round((spent / b.limit) * 100));
    let cls = 'ok';
    if (pct >= 100) cls = 'over';
    else if (pct >= 80) cls = 'warn';
    return `
      <div class="entry-card" data-id="${b.id}">
        <div class="entry-head">
          <span class="e-month">${b.category}</span>
          <span class="e-wallet">${b.wallet === 'aed' ? '🇦🇪 AED' : '🇮🇳 INR'}</span>
        </div>
        <div class="budget-head" style="margin-top:8px;">
          <span class="b-figures">${sym}${spent.toLocaleString('en-IN')} of ${sym}${b.limit.toLocaleString('en-IN')}</span>
        </div>
        <div class="budget-track"><div class="budget-fill ${cls}" style="width:${pct}%"></div></div>
      </div>
    `;
  }).join('');

  el.querySelectorAll('.entry-card').forEach(card => {
    card.addEventListener('click', () => openEditBudget(parseInt(card.dataset.id)));
  });
}

function bindForm() {
  const form = document.getElementById('budgetForm');
  document.getElementById('addBudgetBtn').addEventListener('click', () => {
    editingBudgetId = null;
    document.getElementById('budgetFormTitle').textContent = 'New Budget';
    document.getElementById('saveBudgetBtn').textContent = 'Save Budget';
    document.getElementById('deleteBudgetBtn').style.display = 'none';
    document.getElementById('budgetCategory').selectedIndex = 0;
    document.getElementById('budgetLimit').value = '';
    document.getElementById('budgetWallet').value = 'aed';
    form.classList.add('open');
  });
  document.getElementById('formClose').addEventListener('click', () => form.classList.remove('open'));

  document.getElementById('saveBudgetBtn').addEventListener('click', () => {
    const category = document.getElementById('budgetCategory').value;
    const limit = parseFloat(document.getElementById('budgetLimit').value);
    const wallet = document.getElementById('budgetWallet').value;
    if (!limit || limit <= 0) { document.getElementById('budgetLimit').focus(); return; }

    const budgets = getBudgets();

    // Prevent duplicate budgets for the same category + wallet
    const dupe = budgets.find(b => b.category === category && b.wallet === wallet && b.id !== editingBudgetId);
    if (dupe) { alert(`You already have a ${wallet.toUpperCase()} budget for ${category}. Edit that one instead.`); return; }

    if (editingBudgetId) {
      const idx = budgets.findIndex(b => b.id === editingBudgetId);
      if (idx !== -1) budgets[idx] = { ...budgets[idx], category, limit, wallet };
    } else {
      budgets.push({ id: Date.now(), category, limit, wallet });
    }
    saveBudgets(budgets);

    form.classList.remove('open');
    renderBudgetsList();
    if (typeof syncNow === 'function') syncNow();
  });

  document.getElementById('deleteBudgetBtn').addEventListener('click', () => {
    if (!editingBudgetId) return;
    if (!confirm('Delete this budget?')) return;

    const budgets = getBudgets().filter(b => b.id !== editingBudgetId);
    saveBudgets(budgets);

    document.getElementById('budgetForm').classList.remove('open');
    editingBudgetId = null;
    renderBudgetsList();
    if (typeof syncNow === 'function') syncNow();
  });
}

function openEditBudget(id) {
  const b = getBudgets().find(x => x.id === id);
  if (!b) return;

  editingBudgetId = id;
  document.getElementById('budgetFormTitle').textContent = 'Edit Budget';
  document.getElementById('saveBudgetBtn').textContent = 'Update Budget';
  document.getElementById('deleteBudgetBtn').style.display = 'block';

  document.getElementById('budgetCategory').value = b.category;
  document.getElementById('budgetLimit').value = b.limit;
  document.getElementById('budgetWallet').value = b.wallet;

  document.getElementById('budgetForm').classList.add('open');
}
