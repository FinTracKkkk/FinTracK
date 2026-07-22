/* ============================================================
   FinTrack — Transaction Store
   Persists every expense/income to localStorage so it survives
   reloads, and can be pushed to Supabase in Step 13.
   ============================================================ */

const TX_STORE_KEY = 'ft_transactions';

const DEFAULT_TRANSACTIONS = [];

function getTransactions() {
  const raw = localStorage.getItem(TX_STORE_KEY);
  if (!raw) {
    localStorage.setItem(TX_STORE_KEY, JSON.stringify(DEFAULT_TRANSACTIONS));
    return DEFAULT_TRANSACTIONS;
  }
  return JSON.parse(raw);
}

function addTransaction(tx) {
  const txs = getTransactions();
  const record = { id: 'local_' + Date.now(), synced: false, ...tx };
  txs.unshift(record);
  localStorage.setItem(TX_STORE_KEY, JSON.stringify(txs));
  return record;
}

function markTransactionsSynced(ids) {
  const txs = getTransactions().map(t => ids.includes(t.id) ? { ...t, synced: true } : t);
  localStorage.setItem(TX_STORE_KEY, JSON.stringify(txs));
}

function getTransactionById(id) {
  return getTransactions().find(t => t.id === id) || null;
}

function updateTransaction(id, updates) {
  const txs = getTransactions();
  const idx = txs.findIndex(t => t.id === id);
  if (idx === -1) return null;
  txs[idx] = { ...txs[idx], ...updates, synced: false };
  localStorage.setItem(TX_STORE_KEY, JSON.stringify(txs));
  return txs[idx];
}

function deleteTransaction(id) {
  const txs = getTransactions().filter(t => t.id !== id);
  localStorage.setItem(TX_STORE_KEY, JSON.stringify(txs));
}
