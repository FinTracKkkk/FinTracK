/* ============================================================
   FinTrack — Wallet Store
   Lightweight localStorage-backed balance store shared across
   pages, ahead of the full offline-storage build in Step 12.
   ============================================================ */

const WALLET_STORE_KEY = 'ft_wallet_balances';

function initWalletStore(defaults) {
  if (!localStorage.getItem(WALLET_STORE_KEY)) {
    localStorage.setItem(WALLET_STORE_KEY, JSON.stringify(defaults));
  }
}

function getWalletBalances() {
  return JSON.parse(localStorage.getItem(WALLET_STORE_KEY) || '{}');
}

function getWalletBalance(wallet) {
  const balances = getWalletBalances();
  return balances[wallet] || 0;
}

function adjustWalletBalance(wallet, delta) {
  const balances = getWalletBalances();
  balances[wallet] = (balances[wallet] || 0) + delta;
  localStorage.setItem(WALLET_STORE_KEY, JSON.stringify(balances));
  return balances[wallet];
}
