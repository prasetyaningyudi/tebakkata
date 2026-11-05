function getGame(id) {
  return Store.data.games.find(g => g.id === id) || null;
}

function wordsShownByTeam(game, teamIndex) {
  const set = new Set();
  game.teams[teamIndex].attempts.forEach(a => (a.shown || []).forEach(id => set.add(id)));
  return set;
}

function wordsShownByOtherTeams(game, teamIndex) {
  const set = new Set();
  game.teams.forEach((t, i) => {
    if (i === teamIndex) return;
    t.attempts.forEach(a => (a.shown || []).forEach(id => set.add(id)));
  });
  return set;
}

function buildPool(game, teamIndex) {
  const bank = Store.filterBank(game.categories, game.difficulty);
  const own = wordsShownByTeam(game, teamIndex);
  const others = wordsShownByOtherTeams(game, teamIndex);
  const fresh = bank.filter(w => !own.has(w.id) && !others.has(w.id));
  const total = Math.min(game.wordsPerTeam, fresh.length);
  if (!total) return [];

  const groups = new Map();
  fresh.forEach(w => {
    if (!groups.has(w.category)) groups.set(w.category, []);
    groups.get(w.category).push(w);
  });
  const cats = shuffle(Array.from(groups.keys()));
  cats.forEach(c => shuffle(groups.get(c)));

  const caps = new Map(cats.map(c => [c, groups.get(c).length]));
  const quota = new Map();
  let need = total;
  let active = cats.slice();
  while (active.length) {
    const share = Math.floor(need / active.length);
    let extra = need % active.length;
    const cand = new Map();
    shuffle(active).forEach(c => {
      cand.set(c, share + (extra > 0 ? 1 : 0));
      if (extra > 0) extra--;
    });
    const over = active.filter(c => cand.get(c) > caps.get(c));
    if (!over.length) {
      active.forEach(c => quota.set(c, cand.get(c)));
      break;
    }
    over.forEach(c => {
      quota.set(c, caps.get(c));
      need -= caps.get(c);
    });
    active = active.filter(c => over.indexOf(c) === -1);
  }

  const picked = new Map();
  cats.forEach(c => picked.set(c, groups.get(c).slice(0, quota.get(c) || 0)));

  const pool = [];
  let last = null;
  for (let i = 0; i < total; i++) {
    let candidates = cats.filter(c => (quota.get(c) || 0) > 0 && c !== last);
    if (!candidates.length) candidates = cats.filter(c => (quota.get(c) || 0) > 0);
    if (!candidates.length) break;
    const maxQ = Math.max.apply(null, candidates.map(c => quota.get(c)));
    const top = candidates.filter(c => quota.get(c) === maxQ);
    const pick = top[Math.floor(Math.random() * top.length)];
    pool.push(picked.get(pick).shift());
    quota.set(pick, quota.get(pick) - 1);
    last = pick;
  }
  return pool;
}

function prepareAttempt(game, teamIndex) {
  if (game.activeSession) return { error: 'Masih ada sesi berjalan. Selesaikan dulu.' };
  const pool = buildPool(game, teamIndex);
  if (!pool.length) return { error: 'Tidak ada kata baru tersedia untuk tim ini.' };
  return { pool };
}

function commitAttempt(game, teamIndex, pool) {
  const attempt = {
    startedAt: Date.now(),
    endedAt: null,
    reason: null,
    poolSize: pool.length,
    shown: [pool[0].id],
    guessed: []
  };
  game.teams[teamIndex].attempts.push(attempt);
  game.activeSession = {
    teamIndex,
    endTime: Date.now() + game.minutes * 60000,
    pool: pool.map(w => w.id),
    shown: [pool[0].id],
    guessed: [],
    currentId: pool[0].id
  };
  Store.save();
}

function finishAttempt(game, reason) {
  const s = game.activeSession;
  if (!s) return null;
  const team = game.teams[s.teamIndex];
  const attempt = team.attempts[team.attempts.length - 1];
  if (attempt) {
    attempt.endedAt = Date.now();
    attempt.reason = reason;
    attempt.shown = s.shown.slice();
    attempt.guessed = (s.guessed || []).slice();
  }
  game.activeSession = null;
  Store.save();
  return s.teamIndex;
}

function teamStatus(game, teamIndex) {
  const team = game.teams[teamIndex];
  if (game.activeSession && game.activeSession.teamIndex === teamIndex) {
    return { label: 'Sedang berjalan', cls: 'running' };
  }
  const last = team.attempts[team.attempts.length - 1];
  if (!last) return { label: 'Siap dimainkan', cls: '' };
  if (last.reason === 'time') return { label: 'Selesai (waktu habis)', cls: 'done' };
  if (last.reason === 'words') return { label: 'Selesai (semua tertebak)', cls: 'done' };
  return { label: 'Dihentikan', cls: '' };
}

function difficultyLabel(d) {
  const map = { mudah: 'Mudah', sedang: 'Sedang', susah: 'Susah' };
  const arr = Array.isArray(d) ? d : (d && d !== 'all' ? [d] : []);
  if (!arr.length) return 'Semua kesulitan';
  return arr.map(x => map[x] || x).join(', ');
}

function gameSummary(game) {
  const cats = game.categories && game.categories.length ? game.categories.join(', ') : 'Semua kategori';
  const diff = difficultyLabel(game.difficulty);
  return `${game.teamCount} tim &middot; ${game.minutes} menit/tim &middot; ${game.wordsPerTeam} kata/tim<br>` +
    `${escapeHtml(cats)} &middot; ${escapeHtml(diff)}`;
}

const Create = {
  init() {
    document.getElementById('create-back').onclick = () => nav('screen-games');
    document.getElementById('g-create').onclick = () => this.submit();
    ['g-teams', 'g-minutes', 'g-words'].forEach(id => {
      document.getElementById(id).onchange = () => this.renderCount();
    });
    document.getElementById('cat-checks').onchange = () => this.renderCount();
    document.getElementById('diff-checks').onchange = () => this.renderCount();
    document.getElementById('minute-chips').onclick = e => {
      const chip = e.target.closest('[data-min]');
      if (!chip) return;
      document.getElementById('g-minutes').value = chip.dataset.min;
      this.renderCount();
    };
  },

  render() {
    document.getElementById('g-name').value = nowLabel();
    document.getElementById('g-teams').value = 2;
    document.getElementById('g-minutes').value = 1;
    document.getElementById('g-words').value = 10;
    document.querySelectorAll('#diff-checks input').forEach(i => { i.checked = false; });

    const cats = Store.categories();
    document.getElementById('cat-checks').innerHTML = cats.map(c => `
      <label><input type="checkbox" value="${escapeHtml(c)}"> ${escapeHtml(c)}</label>`).join('') ||
      '<p class="hint">Bank kata masih kosong.</p>';

    this.renderCount();
  },

  selectedCategories() {
    return Array.from(document.querySelectorAll('#cat-checks input:checked')).map(i => i.value);
  },

  selectedDifficulty() {
    return Array.from(document.querySelectorAll('#diff-checks input:checked')).map(i => i.value);
  },

  availableCount() {
    return Store.filterBank(this.selectedCategories(), this.selectedDifficulty()).length;
  },

  renderCount() {
    const teams = Math.max(1, parseInt(document.getElementById('g-teams').value, 10) || 0);
    const perTeam = Math.max(1, parseInt(document.getElementById('g-words').value, 10) || 0);
    const need = teams * perTeam;
    const have = this.availableCount();
    const box = document.getElementById('create-count');
    if (have >= need) {
      box.className = 'info-box ok';
      box.innerHTML = `Tersedia <b>${have}</b> kata &mdash; butuh minimal <b>${need}</b> untuk ${teams} tim. Siap.`;
    } else {
      box.className = 'info-box warn';
      box.innerHTML = `Tersedia <b>${have}</b> kata, butuh minimal <b>${need}</b> untuk ${teams} tim pertama. ` +
        `Tambah kata di Bank Kata atau kurangi jumlah tim/kata.`;
    }
  },

  submit() {
    const name = document.getElementById('g-name').value.trim() || nowLabel();
    const teamCount = parseInt(document.getElementById('g-teams').value, 10);
    const minutes = parseInt(document.getElementById('g-minutes').value, 10);
    const wordsPerTeam = parseInt(document.getElementById('g-words').value, 10);
    const difficulty = this.selectedDifficulty();
    const categories = this.selectedCategories();

    if (!teamCount || teamCount < 1 || teamCount > 50) return toast('Jumlah tim 1-50.');
    if (!minutes || minutes < 1 || minutes > 120) return toast('Waktu 1-120 menit.');
    if (!wordsPerTeam || wordsPerTeam < 1 || wordsPerTeam > 100) return toast('Kata per tim 1-100.');

    const have = Store.filterBank(categories, difficulty).length;
    const need = teamCount * wordsPerTeam;
    if (have < need) {
      if (!confirm(`Bank kata hanya ${have} kata, dibutuhkan minimal ${need} untuk percobaan pertama semua tim. Tetap buat?`)) return;
    }

    const game = {
      id: uid(),
      name,
      createdAt: Date.now(),
      teamCount,
      minutes,
      wordsPerTeam,
      categories,
      difficulty,
      teams: Array.from({ length: teamCount }, (_, i) => ({ index: i + 1, attempts: [] })),
      activeSession: null
    };
    Store.data.games.unshift(game);
    Store.save();
    updateHomeCounts();
    GameDetail.open(game.id);
    toast('Permainan dibuat.');
  }
};

const Games = {
  init() {
    document.getElementById('games-back').onclick = () => nav('screen-home');
    document.getElementById('go-create').onclick = () => {
      nav('screen-create');
      Create.render();
    };
    document.getElementById('games-list').onclick = e => {
      const del = e.target.closest('[data-del]');
      if (del) {
        e.stopPropagation();
        this.remove(del.dataset.del);
        return;
      }
      const card = e.target.closest('[data-id]');
      if (card) GameDetail.open(card.dataset.id);
    };
  },

  render() {
    const list = Store.data.games;
    const box = document.getElementById('games-list');
    if (!list.length) {
      box.innerHTML = '<div class="empty">Belum ada permainan. Tekan "+ Buat Baru".</div>';
      return;
    }
    box.innerHTML = list.map(g => {
      const played = g.teams.reduce((n, t) => n + t.attempts.length, 0);
      return `
        <div class="game-card" data-id="${g.id}">
          <div class="g-name">${escapeHtml(g.name)}</div>
          <div class="g-meta">${gameSummary(g)}<br>Dibuat ${formatDate(g.createdAt)} &middot; ${played} percobaan</div>
          <div class="g-actions">
            <button class="btn small danger" data-del="${g.id}">Hapus</button>
          </div>
        </div>`;
    }).join('');
  },

  remove(id) {
    const g = getGame(id);
    if (!g) return;
    if (g.activeSession) return toast('Permainan ini sedang berjalan.');
    if (!confirm(`Hapus permainan "${g.name}"?`)) return;
    Store.data.games = Store.data.games.filter(x => x.id !== id);
    Store.save();
    this.render();
    updateHomeCounts();
    toast('Permainan dihapus.');
  }
};

const GameDetail = {
  currentId: null,

  init() {
    document.getElementById('detail-back').onclick = () => {
      nav('screen-games');
      Games.render();
    };
    document.getElementById('detail-delete').onclick = () => {
      Games.remove(this.currentId);
      if (!getGame(this.currentId)) nav('screen-games');
    };
    document.getElementById('team-list').onclick = e => {
      const card = e.target.closest('[data-team]');
      if (!card) return;
      const game = getGame(this.currentId);
      if (!game) return;
      const idx = parseInt(card.dataset.team, 10);
      if (game.activeSession) {
        if (game.activeSession.teamIndex === idx) Play.resume(game);
        else toast('Selesaikan sesi yang sedang berjalan dulu.');
        return;
      }
      Play.start(game.id, idx);
    };
  },

  open(id) {
    this.currentId = id;
    nav('screen-game');
    this.render();
  },

  render() {
    const game = getGame(this.currentId);
    if (!game) {
      nav('screen-games');
      Games.render();
      return;
    }
    document.getElementById('detail-name').textContent = game.name;
    document.getElementById('detail-meta').innerHTML = `
      Dibuat <b>${formatDate(game.createdAt)}</b><br>
      <b>${game.teamCount}</b> tim &middot; <b>${game.minutes}</b> menit per tim &middot; <b>${game.wordsPerTeam}</b> kata per tim<br>
      ${escapeHtml(game.categories && game.categories.length ? game.categories.join(', ') : 'Semua kategori')} &middot;
      ${escapeHtml(difficultyLabel(game.difficulty))}`;

    const bank = Store.filterBank(game.categories, game.difficulty).length;
    const need = game.teamCount * game.wordsPerTeam;
    const box = document.getElementById('detail-count');
    box.className = 'info-box ' + (bank >= need ? 'ok' : 'warn');
    box.innerHTML = `Bank kata untuk sesi ini: <b>${bank}</b> kata (butuh minimal <b>${need}</b> untuk percobaan pertama).`;

    document.getElementById('team-list').innerHTML = game.teams.map((t, i) => {
      const st = teamStatus(game, i);
      const n = t.attempts.length;
      const last = t.attempts[n - 1];
      const attemptsLine = n ? `Percobaan ke-${n}` : 'Belum bermain';
      const prog = last && n ? `<br>Tertebak: ${(last.guessed || []).length}/${last.poolSize}` : '';
      return `
        <div class="team-card ${st.cls}" data-team="${i}">
          <div class="team-no">Tim ${i + 1}</div>
          <div class="team-attempts">${attemptsLine}</div>
          <div class="team-status ${st.cls === 'done' ? 'done' : ''}">${st.label}${prog}</div>
        </div>`;
    }).join('');
  }
};
