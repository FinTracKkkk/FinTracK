/* ============================================================
   FinTrack — Salary Module Logic
   ============================================================ */

const SALARY_STORE_KEY = 'ft_salary_entries';

const DEFAULT_ENTRIES = [];

function getSalaryEntries() {
  const raw = localStorage.getItem(SALARY_STORE_KEY);
  if (!raw) {
    localStorage.setItem(SALARY_STORE_KEY, JSON.stringify(DEFAULT_ENTRIES));
    return DEFAULT_ENTRIES;
  }
  return JSON.parse(raw);
}

function saveSalaryEntries(entries) {
  localStorage.setItem(SALARY_STORE_KEY, JSON.stringify(entries));
}

function entryTotal(e) {
  return e.base + e.bonus + e.allowance + e.side + e.investment + e.other;
}

function updateSalaryEntry(id, updates) {
  const entries = getSalaryEntries();
  const idx = entries.findIndex(e => e.id === id);
  if (idx === -1) return null;
  entries[idx] = { ...entries[idx], ...updates, needsSync: true };
  saveSalaryEntries(entries);
  return entries[idx];
}

function deleteSalaryEntry(id) {
  const entries = getSalaryEntries().filter(e => e.id !== id);
  saveSalaryEntries(entries);
}

let editingSalaryId = null;

document.addEventListener('DOMContentLoaded', () => {
  initWalletStore({ aed: 0, inr: 0 }); // no-op if already set
  renderSalaryList();
  bindDrawer();
  bindForm();
});

function renderSalaryList() {
  const entries = getSalaryEntries().slice().reverse();
  const listEl = document.getElementById('salaryList');

  const aedTotal = entries.filter(e => e.wallet === 'aed').reduce((s, e) => s + entryTotal(e), 0);
  const inrTotal = entries.filter(e => e.wallet === 'inr').reduce((s, e) => s + entryTotal(e), 0);
  document.getElementById('totalAed').textContent = 'AED ' + aedTotal.toLocaleString('en-IN');
  document.getElementById('totalInr').textContent = '₹' + inrTotal.toLocaleString('en-IN');

  if (entries.length === 0) {
    listEl.innerHTML = '<div class="empty-state">No salary entries yet. Tap + to add your first one.</div>';
    return;
  }

  listEl.innerHTML = entries.map(e => {
    const sym = e.wallet === 'aed' ? 'AED ' : '₹';
    const parts = [];
    if (e.base) parts.push(`<span>Base: <b>${sym}${e.base.toLocaleString('en-IN')}</b></span>`);
    if (e.bonus) parts.push(`<span>Bonus: <b>${sym}${e.bonus.toLocaleString('en-IN')}</b></span>`);
    if (e.allowance) parts.push(`<span>Allowance: <b>${sym}${e.allowance.toLocaleString('en-IN')}</b></span>`);
    if (e.side) parts.push(`<span>Side income: <b>${sym}${e.side.toLocaleString('en-IN')}</b></span>`);
    if (e.investment) parts.push(`<span>Investment: <b>${sym}${e.investment.toLocaleString('en-IN')}</b></span>`);
    if (e.other) parts.push(`<span>Other: <b>${sym}${e.other.toLocaleString('en-IN')}</b></span>`);
    return `
      <div class="entry-card" data-id="${e.id}">
        <div class="entry-head">
          <span class="e-month">${e.month}</span>
          <span class="e-wallet">${e.wallet === 'aed' ? '🇦🇪 Dubai' : '🇮🇳 India'}</span>
        </div>
        <div class="entry-total">${sym}${entryTotal(e).toLocaleString('en-IN')}</div>
        <div class="entry-breakdown">${parts.join('')}</div>
      </div>
    `;
  }).join('');

  listEl.querySelectorAll('.entry-card').forEach(card => {
    card.addEventListener('click', () => openEditSalary(parseInt(card.dataset.id)));
  });
}

function bindDrawer() {
  const drawer = document.getElementById('drawer');
  const backdrop = document.getElementById('drawerBackdrop');
  document.getElementById('menuBtn').addEventListener('click', () => {
    drawer.classList.add('open');
    backdrop.classList.add('open');
  });
  backdrop.addEventListener('click', () => {
    drawer.classList.remove('open');
    backdrop.classList.remove('open');
  });
}

function bindForm() {
  const form = document.getElementById('salaryForm');
  document.getElementById('addSalaryBtn').addEventListener('click', () => {
    editingSalaryId = null;
    document.getElementById('salaryFormTitle').textContent = 'Add Salary';
    document.getElementById('saveSalaryBtn').textContent = 'Save Salary Entry';
    document.getElementById('deleteSalaryBtn').style.display = 'none';
    resetForm();
    form.classList.add('open');
  });
  document.getElementById('formClose').addEventListener('click', () => form.classList.remove('open'));

  const fields = ['baseInput', 'bonusInput', 'allowanceInput', 'sideInput', 'investmentInput', 'otherInput'];
  fields.forEach(id => document.getElementById(id).addEventListener('input', updateTotalPreview));

  document.getElementById('saveSalaryBtn').addEventListener('click', () => {
    const monthInput = document.getElementById('monthInput').value;
    if (!monthInput) { document.getElementById('monthInput').focus(); return; }

    const wallet = document.getElementById('walletSelect').value;
    const monthLabel = new Date(monthInput + '-02').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const fieldsData = {
      wallet,
      month: monthLabel,
      monthIso: monthInput + '-01',
      base: parseFloat(document.getElementById('baseInput').value) || 0,
      bonus: parseFloat(document.getElementById('bonusInput').value) || 0,
      allowance: parseFloat(document.getElementById('allowanceInput').value) || 0,
      side: parseFloat(document.getElementById('sideInput').value) || 0,
      investment: parseFloat(document.getElementById('investmentInput').value) || 0,
      other: parseFloat(document.getElementById('otherInput').value) || 0,
      notes: document.getElementById('salaryNotesInput').value.trim()
    };

    const total = entryTotal(fieldsData);
    if (total <= 0) { alert('Enter at least one income amount.'); return; }

    if (editingSalaryId) {
      // Reverse the old entry's effect on its wallet balance, then apply the new total
      const old = getSalaryEntries().find(e => e.id === editingSalaryId);
      if (old) adjustWalletBalance(old.wallet, -entryTotal(old));
      updateSalaryEntry(editingSalaryId, fieldsData);
      adjustWalletBalance(wallet, total);
    } else {
      const entries = getSalaryEntries();
      entries.push({ id: Date.now(), needsSync: true, ...fieldsData });
      saveSalaryEntries(entries);
      adjustWalletBalance(wallet, total);
    }

    form.classList.remove('open');
    resetForm();
    renderSalaryList();
    if (typeof syncNow === 'function') syncNow();
  });

  document.getElementById('deleteSalaryBtn').addEventListener('click', () => {
    if (!editingSalaryId) return;
    if (!confirm('Delete this salary entry? This cannot be undone.')) return;

    const old = getSalaryEntries().find(e => e.id === editingSalaryId);
    if (old) adjustWalletBalance(old.wallet, -entryTotal(old));
    deleteSalaryEntry(editingSalaryId);

    form.classList.remove('open');
    resetForm();
    renderSalaryList();
    if (typeof syncNow === 'function') syncNow();
  });
}

function openEditSalary(id) {
  const entry = getSalaryEntries().find(e => e.id === id);
  if (!entry) return;

  editingSalaryId = id;
  document.getElementById('salaryFormTitle').textContent = 'Edit Salary Entry';
  document.getElementById('saveSalaryBtn').textContent = 'Update Entry';
  document.getElementById('deleteSalaryBtn').style.display = 'block';

  document.getElementById('monthInput').value = entry.monthIso ? entry.monthIso.slice(0, 7) : '';
  document.getElementById('walletSelect').value = entry.wallet;
  document.getElementById('baseInput').value = entry.base || '';
  document.getElementById('bonusInput').value = entry.bonus || '';
  document.getElementById('allowanceInput').value = entry.allowance || '';
  document.getElementById('sideInput').value = entry.side || '';
  document.getElementById('investmentInput').value = entry.investment || '';
  document.getElementById('otherInput').value = entry.other || '';
  document.getElementById('salaryNotesInput').value = entry.notes || '';
  updateTotalPreview();

  document.getElementById('salaryForm').classList.add('open');
}

function updateTotalPreview() {
  const vals = ['baseInput', 'bonusInput', 'allowanceInput', 'sideInput', 'investmentInput', 'otherInput']
    .map(id => parseFloat(document.getElementById(id).value) || 0);
  const total = vals.reduce((a, b) => a + b, 0);
  const wallet = document.getElementById('walletSelect').value;
  const sym = wallet === 'aed' ? 'AED ' : '₹';
  document.getElementById('totalPreviewAmount').textContent = sym + total.toLocaleString('en-IN');
}

function resetForm() {
  ['baseInput', 'bonusInput', 'allowanceInput', 'sideInput', 'investmentInput', 'otherInput'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('salaryNotesInput').value = '';
  document.getElementById('monthInput').value = '';
  updateTotalPreview();
}
