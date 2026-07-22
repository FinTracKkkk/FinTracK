/* ============================================================
   FinTrack — Budget Store
   No defaults — budgets start empty until the user creates one.
   ============================================================ */

const BUDGET_STORE_KEY = 'ft_budgets';

function getBudgets() {
  const raw = localStorage.getItem(BUDGET_STORE_KEY);
  if (!raw) {
    localStorage.setItem(BUDGET_STORE_KEY, JSON.stringify([]));
    return [];
  }
  return JSON.parse(raw);
}

function saveBudgets(budgets) {
  localStorage.setItem(BUDGET_STORE_KEY, JSON.stringify(budgets));
}
