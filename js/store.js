const DB_KEY = 'tebakkata.v1';

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatClock(ms) {
  if (ms < 0) ms = 0;
  const total = Math.ceil(ms / 1000);
  return pad2(Math.floor(total / 60)) + ':' + pad2(total % 60);
}

function nowLabel() {
  const d = new Date();
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
    ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}

function formatDate(ts) {
  const d = new Date(ts);
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
    ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}

const SEED_WORDS = [
  ['kucing', 'Hewan', 'mudah'], ['anjing', 'Hewan', 'mudah'], ['sapi', 'Hewan', 'mudah'],
  ['kambing', 'Hewan', 'mudah'], ['kelinci', 'Hewan', 'mudah'], ['ayam', 'Hewan', 'mudah'],
  ['zebra', 'Hewan', 'sedang'], ['jerapah', 'Hewan', 'sedang'], ['buaya', 'Hewan', 'sedang'],
  ['komodo', 'Hewan', 'sedang'], ['penguin', 'Hewan', 'sedang'], ['lumba-lumba', 'Hewan', 'sedang'],
  ['platipus', 'Hewan', 'susah'], ['tapir', 'Hewan', 'susah'], ['anoa', 'Hewan', 'susah'],
  ['salamander', 'Hewan', 'susah'], ['kadal', 'Hewan', 'susah'], ['badak', 'Hewan', 'susah'],

  ['apel', 'Buah', 'mudah'], ['mangga', 'Buah', 'mudah'], ['pisang', 'Buah', 'mudah'],
  ['jeruk', 'Buah', 'mudah'], ['semangka', 'Buah', 'mudah'], ['pepaya', 'Buah', 'mudah'],
  ['anggur', 'Buah', 'sedang'], ['nanas', 'Buah', 'sedang'], ['kiwi', 'Buah', 'sedang'],
  ['alpukat', 'Buah', 'sedang'], ['delima', 'Buah', 'sedang'], ['srikaya', 'Buah', 'sedang'],
  ['jambu', 'Buah', 'susah'], ['sawo', 'Buah', 'susah'], ['lengkeng', 'Buah', 'susah'],
  ['markisa', 'Buah', 'susah'], ['cempedak', 'Buah', 'susah'], ['duku', 'Buah', 'susah'],

  ['nasi', 'Makanan', 'mudah'], ['roti', 'Makanan', 'mudah'], ['mie', 'Makanan', 'mudah'],
  ['telur', 'Makanan', 'mudah'], ['susu', 'Makanan', 'mudah'], ['sate', 'Makanan', 'mudah'],
  ['rendang', 'Makanan', 'sedang'], ['bakso', 'Makanan', 'sedang'], ['soto', 'Makanan', 'sedang'],
  ['gado-gado', 'Makanan', 'sedang'], ['nasi goreng', 'Makanan', 'sedang'], ['mie goreng', 'Makanan', 'sedang'],
  ['gudeg', 'Makanan', 'susah'], ['pempek', 'Makanan', 'susah'], ['tempoyak', 'Makanan', 'susah'],
  ['serabi', 'Makanan', 'susah'], ['klepon', 'Makanan', 'susah'], ['wajik', 'Makanan', 'susah']
];

const IMPORT_EXAMPLE = {
  words: [
    { text: 'kucing', category: 'Hewan', difficulty: 'mudah' },
    { text: 'jerapah', category: 'Hewan', difficulty: 'sedang' },
    { text: 'platipus', category: 'Hewan', difficulty: 'susah' },
    { text: 'apel', category: 'Buah', difficulty: 'mudah' },
    { text: 'alpukat', category: 'Buah', difficulty: 'sedang' },
    { text: 'markisa', category: 'Buah', difficulty: 'susah' },
    { text: 'roti', category: 'Makanan', difficulty: 'mudah' },
    { text: 'bakso', category: 'Makanan', difficulty: 'sedang' },
    { text: 'gudeg', category: 'Makanan', difficulty: 'susah' }
  ]
};

const Store = {
  data: null,

  load() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (raw) this.data = JSON.parse(raw);
    } catch (e) {
      console.error('Gagal membaca penyimpanan', e);
    }
    if (!this.data || !Array.isArray(this.data.words) || !Array.isArray(this.data.games)) {
      this.data = { words: [], games: [], seeded: false };
    }
    if (!this.data.seeded) {
      this.data.words = SEED_WORDS.map(w => ({
        id: uid(), text: w[0], category: w[1], difficulty: w[2]
      }));
      this.data.seeded = true;
      this.save();
    }
    return this.data;
  },

  save() {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.error('Gagal menyimpan', e);
    }
  },

  categories() {
    const set = new Set(this.data.words.map(w => w.category).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'id'));
  },

  filterBank(categories, difficulty) {
    const cats = Array.isArray(categories) ? categories : [];
    const diffs = Array.isArray(difficulty)
      ? difficulty
      : (difficulty && difficulty !== 'all' ? [difficulty] : []);
    return this.data.words.filter(w => {
      if (diffs.length && !diffs.includes(w.difficulty)) return false;
      if (cats.length && !cats.includes(w.category)) return false;
      return true;
    });
  },

  downloadJSON(filename, obj) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  },

  exportJSON(kind) {
    const payload = kind === 'bank'
      ? { app: 'tebakkata', version: 1, exportedAt: new Date().toISOString(), words: this.data.words }
      : { app: 'tebakkata', version: 1, exportedAt: new Date().toISOString(), words: this.data.words, games: this.data.games, seeded: true };
    const name = kind === 'bank'
      ? 'bank-kata-' + nowLabel().replace(/[: ]/g, '-') + '.json'
      : 'backup-tebakkata-' + nowLabel().replace(/[: ]/g, '-') + '.json';
    this.downloadJSON(name, payload);
  },

  downloadExample() {
    this.downloadJSON('contoh-format-bank-kata.json', IMPORT_EXAMPLE);
  },

  parseImport(text) {
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return { error: 'File bukan JSON yang valid.' };
    }
    if (!data || typeof data !== 'object') return { error: 'Format file tidak dikenal.' };
    if (!Array.isArray(data.words)) return { error: 'File tidak berisi daftar kata.' };
    const bad = data.words.find(w => !w || typeof w.text !== 'string' || !w.text.trim());
    if (bad) return { error: 'Ada entri kata yang tidak valid.' };
    return { data };
  },

  importBank(text) {
    const res = this.parseImport(text);
    if (res.error) return res;
    this.data.words = res.data.words.map(w => ({
      id: uid(),
      text: String(w.text).trim(),
      category: String(w.category || 'Umum').trim(),
      difficulty: ['mudah', 'sedang', 'susah'].includes(w.difficulty) ? w.difficulty : 'sedang'
    }));
    this.save();
    return { ok: true, count: this.data.words.length };
  },

  importAll(text) {
    const res = this.parseImport(text);
    if (res.error) return res;
    this.data.words = res.data.words.map(w => ({
      id: uid(),
      text: String(w.text).trim(),
      category: String(w.category || 'Umum').trim(),
      difficulty: ['mudah', 'sedang', 'susah'].includes(w.difficulty) ? w.difficulty : 'sedang'
    }));
    this.data.games = Array.isArray(res.data.games) ? res.data.games : [];
    this.data.seeded = true;
    this.save();
    return { ok: true };
  }
};
