/* ============================================================
   FinTrack — Savings Goals Logic
   ============================================================ */

let openGoalId = null;

document.addEventListener('DOMContentLoaded', () => {
  renderGoalsList();
  bindDrawer();
  bindAddForm();
  bindDetail();
});

function bindDrawer() {
  const drawer = document.getElementById('drawer');
  const backdrop = document.getElementById('drawerBackdrop');
  document.getElementById('menuBtn').addEventListener('click', () => {
    drawer.classList.add('open'); backdrop.classList.add('open');
  });
  backdrop.addEventListener('click', () => {
    drawer.classList.remove('open'); backdrop.classList.remove('open');
  });
}

function renderGoalsList() {
  const goals = getGoals();
  const el = document.getElementById('goalsList');

  if (goals.length === 0) {
    el.innerHTML = '<div class="empty-state">No savings goals yet. Tap + to set one.</div>';
    return;
  }

  el.innerHTML = goals.map(g => {
    const sym = g.wallet === 'aed' ? 'AED ' : '₹';
    const pct = Math.min(100, Math.round((g.current / g.target) * 100));
    return `
      <div class="goal-card" data-id="${g.id}" style="cursor:pointer;">
        <div class="goal-ring" style="background:conic-gradient(var(--gold) ${pct * 3.6}deg, var(--bg-elevated) 0deg)">
          <div style="background:var(--navy-soft);width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;">${pct}%</div>
        </div>
        <div class="goal-info">
          <div class="g-name">${g.name}</div>
          <div class="g-sub">${sym}${g.current.toLocaleString('en-IN')} of ${sym}${g.target.toLocaleString('en-IN')}</div>
        </div>
      </div>
    `;
  }).join('');

  el.querySelectorAll('.goal-card').forEach(card => {
    card.addEventListener('click', () => openDetail(parseInt(card.dataset.id)));
  });
}

let editingGoalId = null;

function bindAddForm() {
  const form = document.getElementById('addGoalForm');
  document.getElementById('addGoalBtn').addEventListener('click', () => {
    editingGoalId = null;
    document.getElementById('goalFormTitle').textContent = 'New Goal';
    document.getElementById('saveGoalBtn').textContent = 'Save Goal';
    document.getElementById('deleteGoalBtn').style.display = 'none';
    ['newGoalName', 'newGoalTarget', 'newGoalCurrent', 'newGoalDate'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('newGoalWallet').value = 'aed';
    form.classList.add('open');
  });
  document.getElementById('addFormClose').addEventListener('click', () => form.classList.remove('open'));

  document.getElementById('saveGoalBtn').addEventListener('click', () => {
    const name = document.getElementById('newGoalName').value.trim();
    const target = parseFloat(document.getElementById('newGoalTarget').value);
    if (!name) { document.getElementById('newGoalName').focus(); return; }
    if (!target || target <= 0) { document.getElementById('newGoalTarget').focus(); return; }

    const fields = {
      name,
      target,
      current: parseFloat(document.getElementById('newGoalCurrent').value) || 0,
      wallet: document.getElementById('newGoalWallet').value,
      targetDate: document.getElementById('newGoalDate').value,
      needsSync: true
    };

    const goals = getGoals();
    if (editingGoalId) {
      const idx = goals.findIndex(g => g.id === editingGoalId);
      if (idx !== -1) goals[idx] = { ...goals[idx], ...fields };
    } else {
      goals.push({ id: Date.now(), ...fields });
    }
    saveGoals(goals);

    form.classList.remove('open');
    ['newGoalName', 'newGoalTarget', 'newGoalCurrent', 'newGoalDate'].forEach(id => document.getElementById(id).value = '');
    renderGoalsList();
    if (typeof syncNow === 'function') syncNow();
  });

  document.getElementById('deleteGoalBtn').addEventListener('click', () => {
    if (!editingGoalId) return;
    if (!confirm('Delete this savings goal? This cannot be undone.')) return;

    const goals = getGoals().filter(g => g.id !== editingGoalId);
    saveGoals(goals);

    form.classList.remove('open');
    editingGoalId = null;
    renderGoalsList();
    if (typeof syncNow === 'function') syncNow();
  });
}

function openEditGoal(id) {
  const g = getGoals().find(x => x.id === id);
  if (!g) return;

  editingGoalId = id;
  document.getElementById('goalFormTitle').textContent = 'Edit Goal';
  document.getElementById('saveGoalBtn').textContent = 'Update Goal';
  document.getElementById('deleteGoalBtn').style.display = 'block';

  document.getElementById('newGoalName').value = g.name;
  document.getElementById('newGoalTarget').value = g.target;
  document.getElementById('newGoalCurrent').value = g.current;
  document.getElementById('newGoalWallet').value = g.wallet;
  document.getElementById('newGoalDate').value = g.targetDate || '';

  document.getElementById('goalDetail').classList.remove('open');
  document.getElementById('addGoalForm').classList.add('open');
}

function openDetail(id) {
  openGoalId = id;
  const g = getGoals().find(x => x.id === id);
  if (!g) return;

  const sym = g.wallet === 'aed' ? 'AED ' : '₹';
  const pct = Math.min(100, Math.round((g.current / g.target) * 100));

  document.getElementById('detailName').textContent = g.name;
  document.getElementById('detailSub').textContent = g.targetDate ? 'Target: ' + new Date(g.targetDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No target date set';
  document.getElementById('detailCurrent').textContent = sym + g.current.toLocaleString('en-IN');
  document.getElementById('detailTarget').textContent = sym + g.target.toLocaleString('en-IN');
  document.getElementById('detailProgressFill').style.width = pct + '%';
  document.getElementById('detailPct').textContent = pct + '%';

  document.getElementById('goalDetail').classList.add('open');
}

function bindDetail() {
  document.getElementById('detailClose').addEventListener('click', () => {
    document.getElementById('goalDetail').classList.remove('open');
    openGoalId = null;
  });

  document.getElementById('editGoalBtn').addEventListener('click', () => {
    if (openGoalId) openEditGoal(openGoalId);
  });

  document.getElementById('contributeBtn').addEventListener('click', () => {
    const amount = parseFloat(document.getElementById('contributeAmountInput').value);
    if (!amount || amount <= 0 || !openGoalId) return;
    addContribution(openGoalId, amount);
    document.getElementById('contributeAmountInput').value = '';
    openDetail(openGoalId);
    renderGoalsList();
    if (typeof syncNow === 'function') syncNow();
  });
}
