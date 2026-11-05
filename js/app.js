let toastTimer = null;

const THEME_KEY = 'tebakkata.theme';

function currentTheme() {
  try {
    const t = localStorage.getItem(THEME_KEY);
    if (t === 'terang' || t === 'gelap') return t;
  } catch (e) {}
  return 'gelap';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme === 'terang' ? 'light' : 'dark');
  try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = 'Tema: ' + (theme === 'terang' ? 'Terang' : 'Gelap');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'terang' ? '#f1f5f9' : '#0b1220');
}

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

function nav(id) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.toggle('active', s.id === id);
  });
  document.body.classList.toggle('playing', id === 'screen-play');
  if (id === 'screen-home') updateHomeCounts();
  if (id === 'screen-games') Games.render();
  if (id === 'screen-bank') Bank.render();
  window.scrollTo(0, 0);
}

function updateHomeCounts() {
  const w = Store.data.words.length;
  const g = Store.data.games.length;
  document.getElementById('bank-count').textContent = w + ' kata';
  document.getElementById('games-count').textContent = g + ' permainan';
}

let importMode = null;

function openImport(mode) {
  importMode = mode;
  const input = document.getElementById('import-file');
  input.value = '';
  input.click();
}

function handleImportFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const text = String(reader.result || '');
    if (importMode === 'bank') {
      if (!confirm('Ganti seluruh bank kata dengan isi file ini?')) return;
      const res = Store.importBank(text);
      if (res.error) return toast(res.error);
      Bank.render();
      updateHomeCounts();
      toast(`${res.count} kata dimuat.`);
    } else {
      if (!confirm('Ganti SELURUH data (kata + permainan) dengan isi file ini?')) return;
      const res = Store.importAll(text);
      if (res.error) return toast(res.error);
      nav('screen-home');
      toast('Backup dipulihkan.');
    }
  };
  reader.readAsText(file);
}

function resumeIfAny() {
  const active = Store.data.games.find(g => g.activeSession);
  if (!active) return false;
  if (Date.now() >= active.activeSession.endTime) {
    Play.expire(active);
    toast('Waktu sesi sebelumnya sudah habis.');
  } else {
    Play.resume(active);
  }
  return true;
}

document.addEventListener('DOMContentLoaded', () => {
  Store.load();

  applyTheme(currentTheme());
  document.getElementById('theme-toggle').onclick = () => {
    applyTheme(currentTheme() === 'gelap' ? 'terang' : 'gelap');
  };

  Sound.init();

  Bank.init();
  Games.init();
  Create.init();
  GameDetail.init();
  Play.init();

  document.getElementById('go-bank').onclick = () => nav('screen-bank');
  document.getElementById('go-games').onclick = () => nav('screen-games');

  document.getElementById('btn-export-all').onclick = () => {
    Store.exportJSON('all');
    toast('Backup diekspor.');
  };
  document.getElementById('btn-import-all').onclick = () => openImport('all');

  document.getElementById('import-file').onchange = e => {
    const file = e.target.files && e.target.files[0];
    if (file) handleImportFile(file);
  };

  updateHomeCounts();

  if (!resumeIfAny()) nav('screen-home');
});
