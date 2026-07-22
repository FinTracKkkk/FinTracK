/* ============================================================
   FinTrack — Quick Add Expense/Income
   ============================================================ */

const CATEGORY_SETS = {
  expense: [
    { name: 'Food & Dining', icon: '🍽️' },
    { name: 'Transport', icon: '🚗' },
    { name: 'Rent & Housing', icon: '🏠' },
    { name: 'Utilities', icon: '💡' },
    { name: 'Shopping', icon: '🛍️' },
    { name: 'Health', icon: '⚕️' },
    { name: 'Family Transfer', icon: '💸' },
    { name: 'Entertainment', icon: '🎬' }
  ],
  income: [
    { name: 'Salary', icon: '💰' },
    { name: 'Bonus', icon: '🎁' },
    { name: 'Side Income', icon: '💼' },
    { name: 'Investment', icon: '📈' }
  ]
};

let qaType = 'expense';
let qaWallet = 'aed';
let qaCategory = null;
let qaReceiptDataUrl = null;
let editingTxId = null;

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('fabBtn').addEventListener('click', openSheet);
  document.getElementById('sheetBackdrop').addEventListener('click', closeSheet);
  document.getElementById('sheetClose').addEventListener('click', closeSheet);

  document.querySelectorAll('.type-toggle button').forEach(btn => {
    btn.addEventListener('click', () => {
      qaType = btn.dataset.type;
      document.querySelectorAll('.type-toggle button').forEach(b => b.classList.remove('active', 'expense', 'income'));
      btn.classList.add('active', qaType);
      qaCategory = null;
      renderCategoryGrid();
    });
  });

  document.querySelectorAll('.wallet-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      qaWallet = chip.dataset.wallet;
      document.querySelectorAll('.wallet-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      document.getElementById('curSymbol').textContent = qaWallet === 'aed' ? 'AED' : '₹';
    });
  });

  document.getElementById('detailsToggle').addEventListener('click', () => {
    const panel = document.getElementById('detailsPanel');
    panel.classList.toggle('open');
    document.getElementById('detailsToggle').textContent =
      panel.classList.contains('open') ? 'Hide details' : 'Add details (payment method, notes, date...)';
  });

  document.getElementById('receiptInput').addEventListener('change', handleReceiptSelect);
  document.getElementById('saveBtn').addEventListener('click', saveTransaction);
  document.getElementById('deleteTxBtn').addEventListener('click', deleteCurrentTransaction);

  renderCategoryGrid();
});

function openSheet() {
  editingTxId = null;
  document.getElementById('sheetTitle').textContent = 'Add Transaction';
  document.getElementById('saveBtn').textContent = 'Save Transaction';
  document.getElementById('deleteTxBtn').style.display = 'none';
  document.getElementById('sheet').classList.add('open');
  document.getElementById('sheetBackdrop').classList.add('open');
  document.getElementById('amountInput').focus();
}

// Opens the same sheet pre-filled with an existing transaction's data for editing.
function openSheetForEdit(id) {
  const tx = getTransactionById(id);
  if (!tx) return;

  editingTxId = id;
  qaType = tx.type;
  qaWallet = tx.wallet;
  qaCategory = tx.category;
  qaReceiptDataUrl = tx.receipt || null;

  document.getElementById('sheetTitle').textContent = 'Edit Transaction';
  document.getElementById('saveBtn').textContent = 'Update Transaction';
  document.getElementById('deleteTxBtn').style.display = 'block';

  document.querySelectorAll('.type-toggle button').forEach(b => b.classList.remove('active', 'expense', 'income'));
  const typeBtn = document.querySelector(`.type-toggle button[data-type="${tx.type}"]`);
  typeBtn.classList.add('active', tx.type);

  document.querySelectorAll('.wallet-chip').forEach(c => c.classList.remove('active'));
  document.querySelector(`.wallet-chip[data-wallet="${tx.wallet}"]`).classList.add('active');
  document.getElementById('curSymbol').textContent = tx.wallet === 'aed' ? 'AED' : '₹';

  document.getElementById('amountInput').value = Math.abs(tx.amount);
  document.getElementById('descInput').value = tx.description || '';
  document.getElementById('notesInput').value = tx.notes || '';

  if (tx.description || tx.notes || tx.receipt) {
    document.getElementById('detailsPanel').classList.add('open');
    document.getElementById('detailsToggle').textContent = 'Hide details';
  }

  if (tx.receipt) {
    document.getElementById('receiptPreviewWrap').innerHTML = `
      <div class="receipt-thumb-wrap">
        <img class="receipt-thumb" src="${tx.receipt}" alt="Receipt preview">
        <button class="receipt-remove" id="removeReceipt">✕</button>
      </div>
    `;
    document.getElementById('removeReceipt').addEventListener('click', () => {
      qaReceiptDataUrl = null;
      document.getElementById('receiptPreviewWrap').innerHTML = '';
    });
  }

  renderCategoryGrid();

  document.getElementById('sheet').classList.add('open');
  document.getElementById('sheetBackdrop').classList.add('open');
}

function closeSheet() {
  document.getElementById('sheet').classList.remove('open');
  document.getElementById('sheetBackdrop').classList.remove('open');
  resetSheet();
}

function resetSheet() {
  document.getElementById('amountInput').value = '';
  document.getElementById('descInput').value = '';
  document.getElementById('notesInput').value = '';
  qaCategory = null;
  qaReceiptDataUrl = null;
  editingTxId = null;
  document.getElementById('receiptPreviewWrap').innerHTML = '';
  document.getElementById('detailsPanel').classList.remove('open');
  document.getElementById('detailsToggle').textContent = 'Add details (payment method, notes, date...)';
  document.getElementById('sheetTitle').textContent = 'Add Transaction';
  document.getElementById('saveBtn').textContent = 'Save Transaction';
  document.getElementById('deleteTxBtn').style.display = 'none';
  renderCategoryGrid();
}

function renderCategoryGrid() {
  const grid = document.getElementById('catGrid');
  const cats = CATEGORY_SETS[qaType];
  grid.innerHTML = cats.map(c => `
    <button class="cat-item ${qaCategory === c.name ? 'selected' : ''}" data-cat="${c.name}">
      <span class="ci-icon">${c.icon}</span>
      <span class="ci-label">${c.name}</span>
    </button>
  `).join('');
  grid.querySelectorAll('.cat-item').forEach(btn => {
    btn.addEventListener('click', () => {
      qaCategory = btn.dataset.cat;
      renderCategoryGrid();
    });
  });
}

function handleReceiptSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    qaReceiptDataUrl = ev.target.result;
    document.getElementById('receiptPreviewWrap').innerHTML = `
      <div class="receipt-thumb-wrap">
        <img class="receipt-thumb" src="${qaReceiptDataUrl}" alt="Receipt preview">
        <button class="receipt-remove" id="removeReceipt">✕</button>
      </div>
    `;
    document.getElementById('removeReceipt').addEventListener('click', () => {
      qaReceiptDataUrl = null;
      document.getElementById('receiptPreviewWrap').innerHTML = '';
      document.getElementById('receiptInput').value = '';
    });
  };
  reader.readAsDataURL(file);
}

function saveTransaction() {
  const amount = parseFloat(document.getElementById('amountInput').value);
  if (!amount || amount <= 0) {
    document.getElementById('amountInput').focus();
    return;
  }
  if (!qaCategory) {
    alert('Pick a category first.');
    return;
  }

  const cat = CATEGORY_SETS[qaType].find(c => c.name === qaCategory);
  const desc = document.getElementById('descInput').value.trim() || qaCategory;
  const currency = qaWallet === 'aed' ? 'AED' : 'INR';

  const fields = {
    wallet: qaWallet,
    type: qaType,
    category: qaCategory,
    icon: cat.icon,
    description: desc,
    amount: qaType === 'expense' ? -amount : amount,
    currency,
    receipt: qaReceiptDataUrl,
    notes: document.getElementById('notesInput').value.trim()
  };

  if (editingTxId) {
    // Reverse the old transaction's effect on its wallet balance before applying the new one
    const old = getTransactionById(editingTxId);
    if (old) {
      if (old.type === 'expense') adjustWalletBalance(old.wallet, Math.abs(old.amount));
      else adjustWalletBalance(old.wallet, -Math.abs(old.amount));
    }
    updateTransaction(editingTxId, fields);
  } else {
    fields.date = new Date().toISOString();
    addTransaction(fields);
  }

  if (qaType === 'expense') {
    adjustWalletBalance(qaWallet, -amount);
  } else {
    adjustWalletBalance(qaWallet, amount);
  }

  if (typeof renderWalletCards === 'function') renderWalletCards();
  if (typeof renderStats === 'function') renderStats();
  if (typeof renderTransactions === 'function') renderTransactions();
  if (typeof renderDonut === 'function') renderDonut();
  if (typeof renderBudgets === 'function') renderBudgets();

  const wasEditing = !!editingTxId;
  closeSheet();
  showToast(wasEditing ? 'Transaction updated' : `${qaType === 'expense' ? 'Expense' : 'Income'} saved`);
  if (typeof syncNow === 'function') syncNow();
}

function deleteCurrentTransaction() {
  if (!editingTxId) return;
  if (!confirm('Delete this transaction? This cannot be undone.')) return;

  const tx = getTransactionById(editingTxId);
  if (tx) {
    // Reverse its effect on the wallet balance before removing it
    if (tx.type === 'expense') adjustWalletBalance(tx.wallet, Math.abs(tx.amount));
    else adjustWalletBalance(tx.wallet, -Math.abs(tx.amount));
  }
  deleteTransaction(editingTxId);

  if (typeof renderWalletCards === 'function') renderWalletCards();
  if (typeof renderStats === 'function') renderStats();
  if (typeof renderTransactions === 'function') renderTransactions();
  if (typeof renderDonut === 'function') renderDonut();
  if (typeof renderBudgets === 'function') renderBudgets();

  closeSheet();
  showToast('Transaction deleted');
  if (typeof syncNow === 'function') syncNow();
}

function showToast(msg) {
  const toast = document.getElementById('saveToast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 1800);
}
