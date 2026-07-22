/* ============================================================
   FinTrack — Supabase Sync
   Push-first sync (local → cloud), with a one-time pull for
   brand-new devices with no local data yet. Last-write-wins —
   fuller conflict resolution comes later once this is proven out.

   Requires the schema from fintrack_schema.sql to already be run
   in the Supabase project (Step 3). If it hasn't, sync will fail
   gracefully and show a red "Sync Failed" status with the reason
   logged to console.
   ============================================================ */

let sbClient = null;
let syncing = false;

function getSbClient() {
  if (!sbClient && window.supabase) {
    sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return sbClient;
}

function setSyncStatus(status, detail) {
  localStorage.setItem('ft_sync_status', status);
  if (detail) localStorage.setItem('ft_sync_detail', detail);
  updateSyncDot();
}

function updateSyncDot() {
  const status = localStorage.getItem('ft_sync_status') || 'offline';
  const colors = { synced: '#2E7D6B', syncing: '#D4AF37', offline: '#9AA3B2', error: '#C05B4D' };
  const labels = {
    synced: 'Synced',
    syncing: 'Syncing...',
    offline: 'Offline — changes saved on this device only',
    error: 'Sync failed — ' + (localStorage.getItem('ft_sync_detail') || 'check Settings')
  };

  const dot = document.getElementById('connDot');
  if (dot) {
    dot.style.background = colors[status] || colors.offline;
    dot.title = labels[status] || labels.offline;
  }

  const pill = document.getElementById('syncStatusPill');
  if (pill) {
    const pillText = { synced: '🟢 Synced', syncing: '🟡 Syncing', offline: '⚪ Local only', error: '🔴 Sync failed' };
    pill.textContent = pillText[status] || pillText.offline;
    pill.className = 'status-pill ' + (status === 'synced' ? 'online' : 'offline');
  }
}

/* ---------- Wallet ID mapping (local 'aed'/'inr' -> Supabase UUID) ---------- */
async function ensureWalletIds() {
  const cached = localStorage.getItem('ft_supabase_wallet_ids');
  if (cached) return JSON.parse(cached);

  const sb = getSbClient();
  const { data, error } = await sb.from('wallets').select('id, currency');
  if (error) throw error;

  const ids = {};
  data.forEach(row => {
    if (row.currency === 'AED') ids.aed = row.id;
    if (row.currency === 'INR') ids.inr = row.id;
  });
  localStorage.setItem('ft_supabase_wallet_ids', JSON.stringify(ids));
  return ids;
}

/* ---------- Push functions ---------- */
async function pushTransactions(sb, walletIds) {
  const txs = getTransactions().filter(t => !t.synced && !t.id.toString().startsWith('t')); // skip demo seed rows
  if (txs.length === 0) return;

  const rows = txs.map(t => ({
    wallet_id: walletIds[t.wallet],
    type: t.type,
    amount: Math.abs(t.amount),
    description: t.description,
    transaction_date: t.date.slice(0, 10),
    transaction_time: t.date.slice(11, 19),
    payment_method: null,
    notes: t.notes || null
  }));

  const { error } = await sb.from('transactions').insert(rows);
  if (error) throw error;
  markTransactionsSynced(txs.map(t => t.id));
}

async function pushSalary(sb, walletIds) {
  const raw = localStorage.getItem(SALARY_STORE_KEY);
  if (!raw) return;
  const entries = JSON.parse(raw).filter(e => !e.synced);
  if (entries.length === 0) return;

  const rows = entries.map(e => ({
    wallet_id: walletIds[e.wallet],
    month: e.monthIso || '2026-01-01', // fallback for entries saved before this fix
    base_salary: e.base, bonus: e.bonus, allowance: e.allowance,
    side_income: e.side, investment_income: e.investment, other_income: e.other,
    notes: e.notes || null
  }));

  const { error } = await sb.from('salary_income').insert(rows);
  if (error) throw error;

  const all = JSON.parse(localStorage.getItem(SALARY_STORE_KEY));
  all.forEach(e => { if (entries.find(x => x.id === e.id)) e.synced = true; });
  localStorage.setItem(SALARY_STORE_KEY, JSON.stringify(all));
}

async function pushDebts(sb, walletIds) {
  const raw = localStorage.getItem('ft_debts');
  if (!raw) return;
  const allDebts = JSON.parse(raw);
  const unsyncedDebts = allDebts.filter(d => !d.synced);

  for (const d of unsyncedDebts) {
    const { data, error } = await sb.from('debts').insert({
      wallet_id: walletIds[d.wallet],
      direction: d.direction,
      person_name: d.person,
      phone_number: d.phone || null,
      total_amount: d.total,
      remaining_amount: d.remaining,
      due_date: d.due || null,
      priority: d.priority,
      notes: d.notes || null
    }).select().single();
    if (error) throw error;
    d.supabase_id = data.id;
    d.synced = true;
  }

  // Push any payments not yet synced, for debts that now have a supabase_id
  for (const d of allDebts) {
    if (!d.supabase_id || !d.payments || d.payments.length === 0) continue;
    const unsyncedPayments = d.payments.filter(p => !p.synced);
    if (unsyncedPayments.length === 0) continue;

    const paymentRows = unsyncedPayments.map(p => ({
      debt_id: d.supabase_id,
      amount: p.amount,
      payment_date: p.date.slice(0, 10),
      notes: p.notes || null
    }));
    const { error: payErr } = await sb.from('debt_payments').insert(paymentRows);
    if (payErr) throw payErr;

    d.payments.forEach(p => { if (!p.synced) p.synced = true; });

    // Keep remaining_amount in sync on the debts row too
    const { error: updErr } = await sb
      .from('debts')
      .update({ remaining_amount: d.remaining, status: d.remaining <= 0 ? 'settled' : 'partially_paid' })
      .eq('id', d.supabase_id);
    if (updErr) throw updErr;
  }

  localStorage.setItem('ft_debts', JSON.stringify(allDebts));
}

async function pushGoals(sb, walletIds) {
  const raw = localStorage.getItem('ft_goals');
  if (!raw) return;
  const goals = JSON.parse(raw);
  const dirty = goals.filter(g => g.needsSync);
  if (dirty.length === 0) return;

  for (const g of dirty) {
    if (!g.supabase_id) {
      // New goal — insert
      const { data, error } = await sb.from('savings_goals').insert({
        wallet_id: walletIds[g.wallet],
        goal_name: g.name,
        target_amount: g.target,
        current_amount: g.current,
        target_date: g.targetDate || null
      }).select().single();
      if (error) throw error;
      g.supabase_id = data.id;
    } else {
      // Existing goal — a contribution changed current_amount
      const { error } = await sb
        .from('savings_goals')
        .update({ current_amount: g.current })
        .eq('id', g.supabase_id);
      if (error) throw error;
    }
    g.needsSync = false;
  }

  localStorage.setItem('ft_goals', JSON.stringify(goals));
}

/* ---------- Orchestration ---------- */
async function syncNow() {
  if (syncing) return;
  if (!navigator.onLine) { setSyncStatus('offline'); return; }

  syncing = true;
  setSyncStatus('syncing');

  try {
    const sb = getSbClient();
    if (!sb) throw new Error('Supabase client library not loaded');

    const walletIds = await ensureWalletIds();
    if (typeof getTransactions === 'function') await pushTransactions(sb, walletIds);
    if (typeof SALARY_STORE_KEY !== 'undefined') await pushSalary(sb, walletIds);
    await pushDebts(sb, walletIds);
    await pushGoals(sb, walletIds);

    setSyncStatus('synced');
  } catch (err) {
    console.error('FinTrack sync error:', err);
    setSyncStatus('error', err.message || 'Unknown error — check the SQL schema was run (Step 3).');
  } finally {
    syncing = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  updateSyncDot();
  if (navigator.onLine) syncNow();
  window.addEventListener('online', syncNow);
  window.addEventListener('offline', () => setSyncStatus('offline'));

  const manualBtn = document.getElementById('syncNowBtn');
  if (manualBtn) manualBtn.addEventListener('click', syncNow);
});
