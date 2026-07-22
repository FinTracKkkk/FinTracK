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

  renderCategoryGrid();
});

function openSheet() {
  document.getElementById('sheet').classList.add('open');
  document.getElementById('sheetBackdrop').classList.add('open');
  document.getElementById('amountInput').focus();
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
  document.getElementById('receiptPreviewWrap').innerHTML = '';
  document.getElementById('detailsPanel').classList.remove('open');
  document.getElementById('detailsToggle').textContent = 'Add details (payment method, notes, date...)';
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

  addTransaction({
    wallet: qaWallet,
    type: qaType,
    category: qaCategory,
    icon: cat.icon,
    description: desc,
    amount: qaType === 'expense' ? -amount : amount,
    currency,
    date: new Date().toISOString(),
    receipt: qaReceiptDataUrl,
    notes: document.getElementById('notesInput').value.trim()
  });

  if (qaType === 'expense') {
    adjustWalletBalance(qaWallet, -amount);
  } else {
    adjustWalletBalance(qaWallet, amount);
  }

  renderWalletCards();
  renderStats();
  renderTransactions();
  renderDonut();
  renderBudgets();

  closeSheet();
  showToast(`${qaType === 'expense' ? 'Expense' : 'Income'} saved`);
  if (typeof syncNow === 'function') syncNow();
}

function showToast(msg) {
  const toast = document.getElementById('saveToast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 1800);
}
