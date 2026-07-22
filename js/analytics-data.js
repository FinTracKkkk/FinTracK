/* ============================================================
   FinTrack — Analytics Data
   Computed live from your real transactions (js/transaction-store.js).
   ============================================================ */

const CATEGORY_COLOR_MAP = {
  'Food & Dining': '#D4AF37', 'Transport': '#64748B', 'Rent & Housing': '#2E7D6B',
  'Utilities': '#334155', 'Shopping': '#C05B4D', 'Health': '#2E7D6B',
  'Family Transfer': '#9AA3B2', 'Entertainment': '#D4AF37'
};

// Returns [start, end) Date range for a bucket of the given period,
// where offset=0 is the current bucket and larger offsets go further back.
function bucketRange(period, offset) {
  const now = new Date();
  let start, end;

  if (period === 'daily') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
    end = new Date(start); end.setDate(end.getDate() + 1);
  } else if (period === 'weekly') {
    const day = now.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const thisMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);
    start = new Date(thisMonday); start.setDate(start.getDate() - offset * 7);
    end = new Date(start); end.setDate(end.getDate() + 7);
  } else if (period === 'monthly') {
    start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 1);
  } else {
    start = new Date(now.getFullYear() - offset, 0, 1);
    end = new Date(now.getFullYear() - offset + 1, 0, 1);
  }
  return [start, end];
}

function bucketLabel(period, offset, start) {
  if (period === 'daily') return offset === 0 ? 'Today' : start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  if (period === 'weekly') return offset === 0 ? 'This wk' : `-${offset}w`;
  if (period === 'monthly') return start.toLocaleDateString('en-US', { month: 'short' });
  return String(start.getFullYear());
}

function sumForRange(txs, wallet, start, end) {
  let income = 0, expense = 0;
  const catMap = {};
  txs.forEach(t => {
    if (t.wallet !== wallet) return;
    const d = new Date(t.date);
    if (d >= start && d < end) {
      if (t.type === 'income') {
        income += Math.abs(t.amount);
      } else {
        expense += Math.abs(t.amount);
        catMap[t.category] = (catMap[t.category] || 0) + Math.abs(t.amount);
      }
    }
  });
  return { income, expense, catMap };
}

function getAnalytics(period, wallet) {
  const txs = getTransactions();
  const [curStart, curEnd] = bucketRange(period, 0);
  const cur = sumForRange(txs, wallet, curStart, curEnd);
  const net = cur.income - cur.expense;
  const totalExpense = cur.expense || 1;

  const categories = Object.keys(cur.catMap)
    .map(name => ({
      name,
      amount: cur.catMap[name],
      pct: Math.round((cur.catMap[name] / totalExpense) * 100),
      color: CATEGORY_COLOR_MAP[name] || '#9AA3B2'
    }))
    .sort((a, b) => b.amount - a.amount);

  const cashflow = [];
  for (let i = 5; i >= 0; i--) {
    const [s, e] = bucketRange(period, i);
    const r = sumForRange(txs, wallet, s, e);
    cashflow.push({ label: bucketLabel(period, i, s), net: r.income - r.expense });
  }

  return { income: cur.income, expense: cur.expense, net, categories, cashflow };
}
