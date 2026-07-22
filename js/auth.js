/* ============================================================
   FinTrack — Authentication
   Handles: PIN login, default password, change/forgot PIN,
   remember-me auto-login, lock screen re-use.

   Storage: localStorage (device-local, works fully offline).
   Keys:
     ft_pin_hash        -> SHA-256 hash of current PIN
     ft_recovery_q       -> recovery question text
     ft_recovery_a_hash  -> SHA-256 hash of recovery answer
     ft_remember_until   -> ISO timestamp; if in future, skip login
     ft_locked           -> 'true' if app is manually locked
   ============================================================ */

const DEFAULT_PIN = '5656';
const PIN_LENGTH = 4;
const REMEMBER_DAYS = 7;

let enteredPin = '';
let isForgotFlow = false;

// ---------- Utility: hashing ----------
async function sha256(text) {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ---------- Theme (applied on every page via this shared script) ----------
function applyStoredTheme() {
  const theme = localStorage.getItem('ft_theme') || 'dark';
  document.body.classList.toggle('light-theme', theme === 'light');
}
applyStoredTheme();

// ---------- Init ----------
async function initAuth() {
  // First run: set default PIN hash if none exists
  if (!localStorage.getItem('ft_pin_hash')) {
    const hash = await sha256(DEFAULT_PIN);
    localStorage.setItem('ft_pin_hash', hash);
    // Prompt to set a recovery question on very first run
    document.getElementById('setupModal').classList.remove('hidden');
  }

  // Auto-login check (remember me)
  const rememberUntil = localStorage.getItem('ft_remember_until');
  const isLocked = localStorage.getItem('ft_locked') === 'true';
  if (rememberUntil && !isLocked && new Date(rememberUntil) > new Date()) {
    goToApp();
    return;
  }

  bindKeypad();
  bindFooterActions();
  bindModals();
}

function goToApp() {
  window.location.href = 'app.html';
}

// ---------- PIN pad ----------
function bindKeypad() {
  document.getElementById('keypad').addEventListener('click', (e) => {
    const btn = e.target.closest('.key');
    if (!btn || !btn.dataset.key) return;
    const key = btn.dataset.key;

    if (key === 'back') {
      enteredPin = enteredPin.slice(0, -1);
    } else if (enteredPin.length < PIN_LENGTH) {
      enteredPin += key;
    }
    renderDots();

    if (enteredPin.length === PIN_LENGTH) {
      handlePinComplete();
    }
  });
}

function renderDots() {
  const dots = document.querySelectorAll('.pin-dot');
  dots.forEach((dot, i) => {
    dot.classList.toggle('filled', i < enteredPin.length);
  });
}

async function handlePinComplete() {
  const enteredHash = await sha256(enteredPin);
  const storedHash = localStorage.getItem('ft_pin_hash');

  if (enteredHash === storedHash) {
    document.getElementById('authError').textContent = '';

    const remember = document.getElementById('rememberMe').checked;
    if (remember) {
      const until = new Date();
      until.setDate(until.getDate() + REMEMBER_DAYS);
      localStorage.setItem('ft_remember_until', until.toISOString());
    } else {
      localStorage.removeItem('ft_remember_until');
    }
    localStorage.removeItem('ft_locked');

    goToApp();
  } else {
    document.getElementById('authError').textContent = 'Incorrect PIN. Try again.';
    const dotsEl = document.getElementById('pinDots');
    dotsEl.classList.add('shake');
    setTimeout(() => {
      dotsEl.classList.remove('shake');
      enteredPin = '';
      renderDots();
    }, 400);
  }
}

// ---------- Forgot PIN flow ----------
function bindFooterActions() {
  document.getElementById('forgotBtn').addEventListener('click', openForgotModal);
}

function openForgotModal() {
  const question = localStorage.getItem('ft_recovery_q');
  const modal = document.getElementById('forgotModal');

  if (!question) {
    // No recovery question was set — cannot self-serve reset
    document.getElementById('forgotStep1Text').textContent =
      "No recovery question was set up. You'll need to clear the app's local storage in your browser settings to reset the PIN (this will also erase locally cached data — cloud-synced data stays safe).";
    document.getElementById('recoveryAnswerInput').style.display = 'none';
    document.getElementById('forgotVerify').style.display = 'none';
  } else {
    document.getElementById('recoveryQuestionLabel').textContent = question;
    document.getElementById('recoveryAnswerInput').style.display = '';
    document.getElementById('forgotVerify').style.display = '';
  }

  modal.classList.remove('hidden');
}

function bindModals() {
  // Forgot modal
  document.getElementById('forgotCancel1').addEventListener('click', closeForgotModal);
  document.getElementById('forgotCancel2').addEventListener('click', closeForgotModal);

  document.getElementById('forgotVerify').addEventListener('click', async () => {
    const answer = document.getElementById('recoveryAnswerInput').value.trim().toLowerCase();
    const storedHash = localStorage.getItem('ft_recovery_a_hash');
    const enteredHash = await sha256(answer);

    if (enteredHash === storedHash) {
      document.getElementById('forgotStep1').style.display = 'none';
      document.getElementById('forgotStep2').style.display = '';
    } else {
      document.getElementById('forgotError').textContent = 'That answer doesn\'t match.';
    }
  });

  document.getElementById('forgotSave').addEventListener('click', async () => {
    const newPin = document.getElementById('newPinInput').value.trim();
    const confirmPin = document.getElementById('confirmPinInput').value.trim();
    const errEl = document.getElementById('forgotError2');

    if (!/^\d{4}$/.test(newPin)) {
      errEl.textContent = 'PIN must be exactly 4 digits.';
      return;
    }
    if (newPin !== confirmPin) {
      errEl.textContent = 'PINs do not match.';
      return;
    }

    localStorage.setItem('ft_pin_hash', await sha256(newPin));
    errEl.textContent = '';
    closeForgotModal();
    document.getElementById('authError').textContent = 'PIN reset. Enter your new PIN.';
  });

  // Setup modal (first run)
  document.getElementById('setupSkip').addEventListener('click', () => {
    document.getElementById('setupModal').classList.add('hidden');
  });

  document.getElementById('setupSave').addEventListener('click', async () => {
    const q = document.getElementById('setupQuestion').value.trim();
    const a = document.getElementById('setupAnswer').value.trim().toLowerCase();
    const errEl = document.getElementById('setupError');

    if (!q || !a) {
      errEl.textContent = 'Please fill in both fields, or tap Skip.';
      return;
    }
    localStorage.setItem('ft_recovery_q', q);
    localStorage.setItem('ft_recovery_a_hash', await sha256(a));
    document.getElementById('setupModal').classList.add('hidden');
  });
}

function closeForgotModal() {
  document.getElementById('forgotModal').classList.add('hidden');
  document.getElementById('forgotStep1').style.display = '';
  document.getElementById('forgotStep2').style.display = 'none';
  document.getElementById('recoveryAnswerInput').value = '';
  document.getElementById('newPinInput').value = '';
  document.getElementById('confirmPinInput').value = '';
  document.getElementById('forgotError').textContent = '';
  document.getElementById('forgotError2').textContent = '';
}

// ---------- Change password (called from app settings later) ----------
async function changePin(oldPin, newPin) {
  const oldHash = await sha256(oldPin);
  const storedHash = localStorage.getItem('ft_pin_hash');
  if (oldHash !== storedHash) return { success: false, message: 'Current PIN is incorrect.' };
  if (!/^\d{4}$/.test(newPin)) return { success: false, message: 'PIN must be 4 digits.' };
  localStorage.setItem('ft_pin_hash', await sha256(newPin));
  return { success: true };
}

// ---------- Logout / Lock (called from app later) ----------
function logout() {
  localStorage.removeItem('ft_remember_until');
  window.location.href = 'index.html';
}

function lockApp() {
  localStorage.setItem('ft_locked', 'true');
  window.location.href = 'index.html';
}

document.addEventListener('DOMContentLoaded', initAuth);

// ---------- Refresh button (shared across every page) ----------
// Reloads the current page in place — same URL, same screen, freshest data.
document.addEventListener('DOMContentLoaded', () => {
  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) refreshBtn.addEventListener('click', () => window.location.reload());
});
