/* Mock data — placeholder until Step 12 (offline storage) and
   Step 13 (Supabase sync) wire in real figures. */

// Shared category → color map, used wherever real transactions are
// grouped by category (Dashboard donut, Budgets, Analytics)
const CATEGORY_COLOR_MAP = {
  'Food & Dining': '#D4AF37', 'Transport': '#64748B', 'Rent & Housing': '#2E7D6B',
  'Utilities': '#334155', 'Shopping': '#C05B4D', 'Health': '#2E7D6B',
  'Family Transfer': '#9AA3B2', 'Entertainment': '#D4AF37'
};

// Your set monthly limits per category (AED). Spent amounts are now
// calculated live from your real transactions, not hardcoded.
const BUDGET_LIMITS = [
  { name: 'Food & Dining', limit: 1500 },
  { name: 'Transport', limit: 600 },
  { name: 'Shopping', limit: 1000 }
];

const MOCK = {
  wallets: {
    aed: { name: 'Dubai Wallet', balance: 8420, trend: +4.2 },
    inr: { name: 'India Wallet', balance: 312500, trend: +1.1 }
  }
};
