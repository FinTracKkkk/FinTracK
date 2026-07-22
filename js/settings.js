/* ============================================================
   FinTrack — Settings Logic
   ============================================================ */

const FT_KEYS_PREFIX = 'ft_';

document.addEventListener('DOMContentLoaded', () => {
  bindDrawer();
  initToggles();
  bindChangePin();
  bindBackupRestore();
  bindReset();
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

/* ---------- Theme + notification toggles ---------- */
function initToggles() {
  const themeToggle = document.getElementById('themeToggle');
  const isLight = (localStorage.getItem('ft_theme') || 'dark') === 'light';
  themeToggle.checked = isLight;
  themeToggle.addEventListener('change', () => {
    const theme = themeToggle.checked ? 'light' : 'dark';
    localStorage.setItem('ft_theme', theme);
    document.body.classList.toggle('light-theme', theme === 'light');
  });

  const notifPrefs = JSON.parse(localStorage.getItem('ft_notif_prefs') || '{"budget":true,"debt":true,"largeExpense":true}');
  ['budget', 'debt', 'largeExpense'].forEach(key => {
    const el = document.getElementById('notif_' + key);
    el.checked = notifPrefs[key];
    el.addEventListener('change', () => {
      notifPrefs[key] = el.checked;
      localStorage.setItem('ft_notif_prefs', JSON.stringify(notifPrefs));
    });
  });

  // Currency / date format — display preference only, stored for later use
  const currencySel = document.getElementById('defaultCurrency');
  currencySel.value = localStorage.getItem('ft_default_currency') || 'aed';
  currencySel.addEventListener('change', () => localStorage.setItem('ft_default_currency', currencySel.value));

  const dateSel = document.getElementById('dateFormat');
  dateSel.value = localStorage.getItem('ft_date_format') || 'dmy';
  dateSel.addEventListener('change', () => localStorage.setItem('ft_date_format', dateSel.value));
}

/* ---------- Change PIN ---------- */
function bindChangePin() {
  const modal = document.getElementById('changePinModal');
  document.getElementById('changePinRow').addEventListener('click', () => modal.classList.remove('hidden'));
  document.getElementById('cpCancel').addEventListener('click', () => closeChangePinModal());

  document.getElementById('cpSave').addEventListener('click', async () => {
    const oldPin = document.getElementById('cpOld').value.trim();
    const newPin = document.getElementById('cpNew').value.trim();
    const confirmPin = document.getElementById('cpConfirm').value.trim();
    const msgEl = document.getElementById('cpMsg');

    if (newPin !== confirmPin) {
      msgEl.textContent = 'New PINs do not match.';
      msgEl.className = 'modal-msg error';
      return;
    }
    const result = await changePin(oldPin, newPin);
    if (result.success) {
      msgEl.textContent = 'PIN changed successfully.';
      msgEl.className = 'modal-msg success';
      setTimeout(closeChangePinModal, 1200);
    } else {
      msgEl.textContent = result.message;
      msgEl.className = 'modal-msg error';
    }
  });
}

function closeChangePinModal() {
  document.getElementById('changePinModal').classList.add('hidden');
  ['cpOld', 'cpNew', 'cpConfirm'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('cpMsg').textContent = '';
}

/* ---------- Backup / Restore ---------- */
function bindBackupRestore() {
  document.getElementById('backupBtn').addEventListener('click', () => {
    const data = {};
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith(FT_KEYS_PREFIX)) data[k] = localStorage.getItem(k);
    });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fintrack-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('restoreInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        Object.keys(data).forEach(k => {
          if (k.startsWith(FT_KEYS_PREFIX)) localStorage.setItem(k, data[k]);
        });
        alert('Backup restored. Reloading app...');
        window.location.href = 'app.html';
      } catch (err) {
        alert('That file could not be read as a valid FinTrack backup.');
      }
    };
    reader.readAsText(file);
  });
}

/* ---------- Reset app ---------- */
function bindReset() {
  const modal = document.getElementById('resetModal');
  const input = document.getElementById('resetPinInput');
  const msg = document.getElementById('resetMsg');
  const confirmBtn = document.getElementById('resetConfirmBtn');

  document.getElementById('resetBtn').addEventListener('click', () => {
    input.value = '';
    msg.textContent = '';
    confirmBtn.disabled = false;
    modal.classList.remove('hidden');
    input.focus();
  });

  document.getElementById('resetCancel').addEventListener('click', () => {
    modal.classList.add('hidden');
  });

  confirmBtn.addEventListener('click', async () => {
    const pin = input.value.trim();
    if (!/^\d{4}$/.test(pin)) {
      msg.textContent = 'Enter your 4-digit PIN.';
      msg.className = 'modal-msg error';
      return;
    }

    const enteredHash = await sha256(pin);
    const storedHash = localStorage.getItem('ft_pin_hash');
    if (enteredHash !== storedHash) {
      msg.textContent = 'Incorrect PIN.';
      msg.className = 'modal-msg error';
      return;
    }

    const keysToRemove = Object.keys(localStorage).filter(k => k.startsWith(FT_KEYS_PREFIX));
    keysToRemove.forEach(k => localStorage.removeItem(k));

    msg.textContent = `Erased ${keysToRemove.length} item(s). Redirecting...`;
    msg.className = 'modal-msg success';
    confirmBtn.disabled = true;

    setTimeout(() => {
      window.location.href = 'index.html';
    }, 900);
  });
}
