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

function bindAddForm() {
  const form = document.getElementById('addGoalForm');
  document.getElementById('addGoalBtn').addEventListener('click', () => form.classList.add('open'));
  document.getElementById('addFormClose').addEventListener('click', () => form.classList.remove('open'));

  document.getElementById('saveGoalBtn').addEventListener('click', () => {
    const name = document.getElementById('newGoalName').value.trim();
    const target = parseFloat(document.getElementById('newGoalTarget').value);
    if (!name) { document.getElementById('newGoalName').focus(); return; }
    if (!target || target <= 0) { document.getElementById('newGoalTarget').focus(); return; }

    const goals = getGoals();
    goals.push({
      id: Date.now(),
      name,
      target,
      current: parseFloat(document.getElementById('newGoalCurrent').value) || 0,
      wallet: document.getElementById('newGoalWallet').value,
      targetDate: document.getElementById('newGoalDate').value,
      needsSync: true
    });
    saveGoals(goals);

    form.classList.remove('open');
    ['newGoalName', 'newGoalTarget', 'newGoalCurrent', 'newGoalDate'].forEach(id => document.getElementById(id).value = '');
    renderGoalsList();
  });
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

  document.getElementById('contributeBtn').addEventListener('click', () => {
    const amount = parseFloat(document.getElementById('contributeAmountInput').value);
    if (!amount || amount <= 0 || !openGoalId) return;
    addContribution(openGoalId, amount);
    document.getElementById('contributeAmountInput').value = '';
    openDetail(openGoalId);
    renderGoalsList();
  });
}
