const Play = {
  game: null,
  timerId: null,
  wakeLock: null,

  init() {
    document.getElementById('btn-pas').onclick = () => this.advance('pas');
    document.getElementById('btn-next').onclick = () => this.advance('next');
    document.getElementById('play-exit').onclick = () => this.exit();
    document.getElementById('res-continue').onclick = () => {
      if (this.resultGameId) GameDetail.open(this.resultGameId);
    };
  },

  start(gameId, teamIndex) {
    const game = getGame(gameId);
    if (!game) return;
    const prep = prepareAttempt(game, teamIndex);
    if (prep.error) return toast(prep.error);
    if (prep.pool.length < game.wordsPerTeam) {
      const ok = confirm(`Hanya ${prep.pool.length} kata baru tersedia (diminta ${game.wordsPerTeam}). Mulai tetap?`);
      if (!ok) return;
    }
    commitAttempt(game, teamIndex, prep.pool);
    this.open(game);
  },

  resume(game) {
    if (!game || !game.activeSession) return;
    this.open(game);
  },

  expire(game) {
    if (!game || !game.activeSession) return;
    const teamIndex = game.activeSession.teamIndex;
    finishAttempt(game, 'time');
    this.showResult(game, teamIndex, 'time');
  },

  open(game) {
    this.stopTimer();
    this.game = game;
    if (game.activeSession && !Array.isArray(game.activeSession.guessed)) {
      game.activeSession.guessed = [];
    }
    nav('screen-play');
    this.render();
    this.startTimer();
    this.requestWakeLock();
  },

  session() {
    return this.game && this.game.activeSession ? this.game.activeSession : null;
  },

  attempt() {
    const s = this.session();
    if (!s) return null;
    const team = this.game.teams[s.teamIndex];
    return team.attempts[team.attempts.length - 1];
  },

  render() {
    const g = this.game;
    const s = this.session();
    if (!s) return;
    document.getElementById('play-team-name').textContent = 'Tim ' + (s.teamIndex + 1);
    document.getElementById('play-attempt').textContent =
      'Percobaan ke-' + g.teams[s.teamIndex].attempts.length;
    this.renderWord();
    this.tick();
  },

  renderWord(sfx) {
    const s = this.session();
    if (!s) return;
    const word = Store.data.words.find(w => w.id === s.currentId);
    const el = document.getElementById('play-word');
    const text = word ? word.text : '—';
    el.textContent = text;
    el.className = 'play-word' + (text.length > 14 ? ' len-xl' : text.length > 8 ? ' len-l' : '');
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';

    document.getElementById('play-progress').textContent =
      'Tertebak ' + (s.guessed || []).length + '/' + s.pool.length;

    const hint = document.getElementById('play-hint');
    hint.className = 'play-hint';
    hint.textContent = '';

    if (sfx === 'next') Sound.nextSound();
    else if (sfx === 'pas') Sound.pasSound();
    else Sound.wordReveal();
  },

  startTimer() {
    this.tick();
    this.timerId = setInterval(() => this.tick(), 200);
  },

  stopTimer() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    Sound.heartStop();
    this.releaseWakeLock();
  },

  tick() {
    const s = this.session();
    const el = document.getElementById('play-timer');
    if (!s) {
      el.textContent = '00:00';
      return;
    }
    const remain = s.endTime - Date.now();
    el.textContent = formatClock(remain);
    el.classList.toggle('danger', remain <= 10000);
    if (remain > 0) Sound.heartTick(remain);
    else Sound.heartStop();
    if (remain <= 0) {
      this.end('time');
    }
  },

  advance(mode) {
    const s = this.session();
    if (!s) return;
    if (!Array.isArray(s.guessed)) s.guessed = [];

    if (mode === 'next') {
      if (!s.guessed.includes(s.currentId)) {
        s.guessed.push(s.currentId);
        const a = this.attempt();
        if (a) a.guessed = s.guessed.slice();
      }
      if (s.guessed.length >= s.pool.length) {
        Store.save();
        this.end('words');
        return;
      }
    }

    const idx = s.pool.indexOf(s.currentId);
    let target = null;
    for (let k = 1; k <= s.pool.length; k++) {
      const ni = (idx + k) % s.pool.length;
      if (!s.guessed.includes(s.pool[ni])) {
        target = s.pool[ni];
        break;
      }
    }
    if (!target) {
      this.end('words');
      return;
    }
    s.currentId = target;
    if (!s.shown.includes(target)) {
      s.shown.push(target);
      const a = this.attempt();
      if (a) a.shown = s.shown.slice();
    }
    Store.save();
    this.renderWord(mode === 'next' ? 'next' : 'pas');
  },

  end(reason) {
    const game = this.game;
    if (!game || !game.activeSession) return;
    const teamIndex = game.activeSession.teamIndex;
    finishAttempt(game, reason);
    this.stopTimer();
    Sound.endSound(reason);
    this.game = null;
    this.showResult(game, teamIndex, reason);
  },

  showResult(game, teamIndex, reason) {
    const team = game.teams[teamIndex];
    const a = team.attempts[team.attempts.length - 1];
    const guessed = (a && a.guessed) || [];
    const poolSize = (a && a.poolSize) || guessed.length;

    document.getElementById('res-team').textContent = 'Tim ' + (teamIndex + 1);
    document.getElementById('res-attempt').textContent =
      'Percobaan ke-' + team.attempts.length;
    document.getElementById('res-score').textContent = guessed.length + '/' + poolSize;
    document.getElementById('res-reason').textContent =
      reason === 'time' ? 'Waktu habis' :
      reason === 'words' ? 'Semua kata tertebak' : 'Sesi dihentikan';

    const words = guessed
      .map(id => Store.data.words.find(w => w.id === id))
      .filter(Boolean);
    document.getElementById('res-words').innerHTML = words.length
      ? words.map(w => `<span class="res-chip">${escapeHtml(w.text)}</span>`).join('')
      : '<span class="hint">Belum ada kata yang tertebak.</span>';

    this.resultGameId = game.id;
    nav('screen-result');
  },

  exit() {
    const s = this.session();
    if (!s) return;
    if (!confirm('Akhiri sesi tim ini?')) return;
    this.end('exit');
  },

  async requestWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        this.wakeLock = await navigator.wakeLock.request('screen');
      }
    } catch (e) {
      this.wakeLock = null;
    }
  },

  releaseWakeLock() {
    if (this.wakeLock) {
      this.wakeLock.release().catch(() => {});
      this.wakeLock = null;
    }
  }
};
