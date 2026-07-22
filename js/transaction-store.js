/* ============================================================
   FinTrack — Transaction Store
   Persists every expense/income to localStorage so it survives
   reloads, and can be pushed to Supabase in Step 13.
   ============================================================ */

const TX_STORE_KEY = 'ft_transactions';

const DEFAULT_TRANSACTIONS = [
  { id: 't1', wallet: 'aed', type: 'expense', category: 'Food & Dining', icon: '🍽️', description: 'Carrefour Groceries', amount: -185, currency: 'AED', date: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), synced: false },
  { id: 't2', wallet: 'aed', type: 'income', category: 'Salary', icon: '💰', description: 'Salary — July', amount: 9500, currency: 'AED', date: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), synced: false },
  { id: 't3', wallet: 'aed', type: 'expense', category: 'Transport', icon: '🚗', description: 'Careem Ride', amount: -42, currency: 'AED', date: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(), synced: false },
  { id: 't4', wallet: 'inr', type: 'expense', category: 'Family Transfer', icon: '💸', description: 'Family Transfer', amount: -15000, currency: 'INR', date: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), synced: false },
  { id: 't5', wallet: 'aed', type: 'expense', category: 'Utilities', icon: '💡', description: 'Electricity Bill (DEWA)', amount: -310, currency: 'AED', date: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(), synced: false }
];

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
