/* ============================================================
   FinTrack — Savings Goals Store
   ============================================================ */

const GOALS_KEY = 'ft_goals';

const DEFAULT_GOALS = [];

function getGoals() {
  const raw = localStorage.getItem(GOALS_KEY);
  if (!raw) {
    localStorage.setItem(GOALS_KEY, JSON.stringify(DEFAULT_GOALS));
    return DEFAULT_GOALS;
  }
  return JSON.parse(raw);
}

function saveGoals(goals) {
  localStorage.setItem(GOALS_KEY, JSON.stringify(goals));
}

function addContribution(goalId, amount) {
  const goals = getGoals();
  const goal = goals.find(g => g.id === goalId);
  if (!goal) return null;
  goal.current += amount;
  goal.needsSync = true;
  saveGoals(goals);
  return goal;
}
