/* ============================================================
   FinTrack — Split Expense Store
   Split groups live in their own store (ft_splits). Each friend's
   share is also written into the shared debts store (ft_debts,
   direction: 'owed_to_me', source: 'split') so it automatically
   folds into the existing "Owed to Me" totals on the Dashboard
   and Debts page, and rides the existing Supabase sync in sync.js
   with zero extra wiring.
   ============================================================ */

const SPLIT_STORE_KEY = 'ft_splits';

/* ---------- Shared debts store (same 'ft_debts' key debts.js uses) ----------
   Duplicated here (rather than loading debts.js) so this file works standalone
   on splits.html without debts.html-only DOM bindings throwing on load. ---------- */
const DEBT_STORE_KEY = 'ft_debts';
function getDebts() {
  const raw = localStorage.getItem(DEBT_STORE_KEY);
  if (!raw) { localStorage.setItem(DEBT_STORE_KEY, JSON.stringify([])); return []; }
  return JSON.parse(raw);
}
function saveDebts(debts) { localStorage.setItem(DEBT_STORE_KEY, JSON.stringify(debts)); }

// Strictly increasing IDs (Date.now() alone can collide/misorder when several
// friend-debts are created in the same split, or two splits are saved within
// the same millisecond) — needed so FIFO payment allocation is reliable.
let __splitIdCounter = 0;
function nextDebtId() { return Date.now() * 1000 + (__splitIdCounter++ % 1000); }

function getSplits() {
  const raw = localStorage.getItem(SPLIT_STORE_KEY);
  if (!raw) {
    localStorage.setItem(SPLIT_STORE_KEY, JSON.stringify([]));
    return [];
  }
  return JSON.parse(raw);
}
function saveSplits(splits) { localStorage.setItem(SPLIT_STORE_KEY, JSON.stringify(splits)); }

/* ---------- Equal-split math (cent-accurate, no rounding drift) ---------- */
function computeEqualShares(totalAmount, friendCount) {
  const totalCents = Math.round(totalAmount * 100);
  const base = Math.floor(totalCents / friendCount);
  let remainder = totalCents - (base * friendCount);
  const shares = [];
  for (let i = 0; i < friendCount; i++) {
    let cents = base;
    if (remainder > 0) { cents += 1; remainder -= 1; } // spread leftover cents across the first N friends
    shares.push(Math.round(cents) / 100);
  }
  return shares;
}

/* ---------- Create a new split + matching debts ---------- */
function createSplit({ title, totalAmount, wallet, date, friendNames, notes }) {
  const names = friendNames.map(n => n.trim()).filter(Boolean);
  if (names.length === 0) throw new Error('At least one friend is required.');
  if (!totalAmount || totalAmount <= 0) throw new Error('Total amount must be greater than zero.');

  const shares = computeEqualShares(totalAmount, names.length);
  const splitId = 'sp' + Date.now();
  const debts = getDebts();
  const friends = [];

  names.forEach((name, i) => {
    const debtId = nextDebtId();
    debts.push({
      id: debtId,
      direction: 'owed_to_me',
      person: name,
      phone: '',
      wallet,
      total: shares[i],
      remaining: shares[i],
      due: '',
      priority: 'normal',
      notes: `Split expense: ${title}`,
      payments: [],
      source: 'split',
      splitId,
      splitTitle: title,
      splitDate: date || new Date().toISOString().slice(0, 10)
    });
    friends.push({ name, share: shares[i], debtId });
  });

  saveDebts(debts);

  const splits = getSplits();
  splits.push({
    id: splitId,
    title: title.trim(),
    totalAmount,
    wallet,
    date: date || new Date().toISOString().slice(0, 10),
    createdAt: new Date().toISOString(),
    notes: (notes || '').trim(),
    friends
  });
  saveSplits(splits);

  return splitId;
}

function deleteSplit(splitId) {
  const splits = getSplits().filter(s => s.id !== splitId);
  saveSplits(splits);
  // Remove the friend debts that belonged to this split (only if untouched — see splits.js confirm step)
  const debts = getDebts().filter(d => d.splitId !== splitId);
  saveDebts(debts);
}

/* ---------- Derived views ---------- */
function getSplitDebts() {
  return getDebts().filter(d => d.source === 'split' && d.direction === 'owed_to_me');
}

// Group split debts by person + currency so balances accumulate automatically
// across every split that person appears in (per currency).
function getFriendBalances(walletFilter) {
  const debts = getSplitDebts().filter(d => !walletFilter || d.wallet === walletFilter);
  const map = {};
  debts.forEach(d => {
    const key = d.person.trim().toLowerCase() + '|' + d.wallet;
    if (!map[key]) map[key] = { name: d.person.trim(), wallet: d.wallet, total: 0, remaining: 0, entries: [] };
    map[key].total += d.total;
    map[key].remaining += d.remaining;
    map[key].entries.push(d);
  });
  return Object.values(map).sort((a, b) => b.remaining - a.remaining);
}

// Apply a payment against a friend's pooled balance, oldest split first (FIFO),
// never letting any entry (or the pool) go negative.
function registerFriendPayment(personName, wallet, amount) {
  if (!amount || amount <= 0) throw new Error('Enter a valid payment amount.');
  const debts = getDebts();
  const entries = debts
    .filter(d => d.source === 'split' && d.direction === 'owed_to_me' && d.wallet === wallet &&
      d.person.trim().toLowerCase() === personName.trim().toLowerCase() && d.remaining > 0)
    .sort((a, b) => a.id - b.id);

  let left = Math.round(amount * 100) / 100;
  const totalOwed = entries.reduce((s, d) => s + d.remaining, 0);
  if (left > totalOwed) left = totalOwed; // never overpay / never go negative

  const now = new Date().toISOString();
  entries.forEach(d => {
    if (left <= 0) return;
    const applied = Math.min(left, d.remaining);
    d.remaining = Math.round((d.remaining - applied) * 100) / 100;
    d.payments.push({ amount: applied, currency: wallet, date: now, notes: '' });
    left = Math.round((left - applied) * 100) / 100;
  });

  saveDebts(debts);
  if (typeof syncNow === 'function') syncNow();
}

function getExpenseHistory(walletFilter) {
  const debts = getDebts();
  return getSplits()
    .filter(s => !walletFilter || s.wallet === walletFilter)
    .map(s => {
      const friendDebts = s.friends.map(f => debts.find(d => d.id === f.debtId)).filter(Boolean);
      const collected = friendDebts.reduce((sum, d) => sum + (d.total - d.remaining), 0);
      const outstanding = friendDebts.reduce((sum, d) => sum + d.remaining, 0);
      return {
        ...s,
        collected: Math.round(collected * 100) / 100,
        outstanding: Math.round(outstanding * 100) / 100,
        progress: s.totalAmount > 0 ? Math.round((collected / s.totalAmount) * 100) : 0,
        status: outstanding <= 0 ? 'settled' : (collected > 0 ? 'partial' : 'open')
      };
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function getPaymentHistory(walletFilter) {
  const rows = [];
  getSplitDebts().filter(d => !walletFilter || d.wallet === walletFilter).forEach(d => {
    (d.payments || []).forEach(p => {
      rows.push({
        friend: d.person,
        amount: p.amount,
        currency: p.currency || d.wallet,
        date: p.date,
        splitTitle: d.splitTitle,
        splitId: d.splitId,
        debtId: d.id
      });
    });
  });
  rows.sort((a, b) => new Date(b.date) - new Date(a.date));
  return rows;
}

function splitDashboardStats(walletFilter) {
  const debts = getSplitDebts().filter(d => !walletFilter || d.wallet === walletFilter);
  const splits = getSplits().filter(s => !walletFilter || s.wallet === walletFilter);
  const totalExpenses = splits.reduce((s, x) => s + x.totalAmount, 0);
  const totalOutstanding = debts.reduce((s, d) => s + d.remaining, 0);
  const totalCollected = debts.reduce((s, d) => s + (d.total - d.remaining), 0);
  const activeDebtors = new Set(debts.filter(d => d.remaining > 0).map(d => d.person.trim().toLowerCase())).size;
  const settledPayments = debts.filter(d => d.remaining <= 0 && d.total > 0).length;
  return {
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    totalOutstanding: Math.round(totalOutstanding * 100) / 100,
    totalCollected: Math.round(totalCollected * 100) / 100,
    activeDebtors,
    settledPayments,
    expenseCount: splits.length
  };
}
