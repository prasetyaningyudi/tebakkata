const Bank = {
  editingId: null,

  init() {
    document.getElementById('bank-back').onclick = () => nav('screen-home');
    document.getElementById('word-save').onclick = () => this.save();
    document.getElementById('word-cancel').onclick = () => this.resetForm();
    document.getElementById('bulk-add').onclick = () => this.bulkAdd();
    document.getElementById('filter-search').oninput = () => this.renderList();
    document.getElementById('filter-cat').onchange = () => this.renderList();
    document.getElementById('filter-diff').onchange = () => this.renderList();
    document.getElementById('word-list').onclick = e => this.onListClick(e);
    document.getElementById('bank-export').onclick = () => {
      Store.exportJSON('bank');
      toast('Bank kata diekspor.');
    };
    document.getElementById('bank-import').onclick = () => openImport('bank');
    document.getElementById('bank-example').onclick = () => {
      Store.downloadExample();
      toast('Contoh format diunduh.');
    };
  },

  render() {
    this.resetForm();
    this.renderCats();
    this.renderList();
    document.getElementById('format-sample').textContent =
      JSON.stringify(IMPORT_EXAMPLE, null, 2);
  },

  renderCats() {
    const cats = Store.categories();
    const dl = document.getElementById('cat-list');
    dl.innerHTML = cats.map(c => `<option value="${escapeHtml(c)}">`).join('');

    const filter = document.getElementById('filter-cat');
    const cur = filter.value;
    filter.innerHTML = '<option value="">Semua kategori</option>' +
      cats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    if (cats.includes(cur)) filter.value = cur;
  },

  renderList() {
    const q = document.getElementById('filter-search').value.trim().toLowerCase();
    const cat = document.getElementById('filter-cat').value;
    const diff = document.getElementById('filter-diff').value;
    let words = Store.data.words.slice();
    if (q) words = words.filter(w => w.text.toLowerCase().includes(q));
    if (cat) words = words.filter(w => w.category === cat);
    if (diff) words = words.filter(w => w.difficulty === diff);

    const box = document.getElementById('word-list');
    if (!words.length) {
      box.innerHTML = '<div class="empty">Tidak ada kata.</div>';
      return;
    }
    box.innerHTML = words.map(w => `
      <div class="word-row">
        <span class="word-text">${escapeHtml(w.text)}</span>
        <span class="badge">${escapeHtml(w.category)}</span>
        <span class="badge diff-${w.difficulty}">${w.difficulty}</span>
        <span class="word-actions">
          <button class="btn small" data-edit="${w.id}">Ubah</button>
          <button class="btn small danger" data-del="${w.id}">Hapus</button>
        </span>
      </div>`).join('');
  },

  onListClick(e) {
    const edit = e.target.closest('[data-edit]');
    const del = e.target.closest('[data-del]');
    if (edit) this.startEdit(edit.dataset.edit);
    if (del) this.remove(del.dataset.del);
  },

  save() {
    const text = document.getElementById('word-text').value.trim();
    const category = document.getElementById('word-cat').value.trim() || 'Umum';
    const difficulty = document.getElementById('word-diff').value;
    if (!text) {
      toast('Isi kata dulu.');
      document.getElementById('word-text').focus();
      return;
    }
    if (this.editingId) {
      const w = Store.data.words.find(x => x.id === this.editingId);
      if (w) {
        w.text = text;
        w.category = category;
        w.difficulty = difficulty;
      }
      toast('Kata diperbarui.');
    } else {
      Store.data.words.push({ id: uid(), text, category, difficulty });
      toast('Kata ditambahkan.');
    }
    Store.save();
    this.resetForm();
    this.renderCats();
    this.renderList();
    updateHomeCounts();
  },

  bulkAdd() {
    const lines = document.getElementById('bulk-text').value
      .split('\n').map(s => s.trim()).filter(Boolean);
    if (!lines.length) {
      toast('Tulis kata dulu, satu per baris.');
      return;
    }
    const category = document.getElementById('word-cat').value.trim() || 'Umum';
    const difficulty = document.getElementById('word-diff').value;
    const existing = new Set(Store.data.words.map(w => w.text.toLowerCase()));
    let added = 0;
    lines.forEach(t => {
      if (existing.has(t.toLowerCase())) return;
      Store.data.words.push({ id: uid(), text: t, category, difficulty });
      existing.add(t.toLowerCase());
      added++;
    });
    Store.save();
    document.getElementById('bulk-text').value = '';
    toast(added ? `${added} kata ditambahkan.` : 'Semua kata sudah ada di bank.');
    this.renderCats();
    this.renderList();
    updateHomeCounts();
  },

  startEdit(id) {
    const w = Store.data.words.find(x => x.id === id);
    if (!w) return;
    this.editingId = id;
    document.getElementById('word-text').value = w.text;
    document.getElementById('word-cat').value = w.category;
    document.getElementById('word-diff').value = w.difficulty;
    document.getElementById('bank-form-title').textContent = 'Ubah Kata';
    document.getElementById('word-save').textContent = 'Simpan';
    document.getElementById('word-cancel').classList.remove('hidden');
    document.getElementById('word-text').focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  resetForm() {
    this.editingId = null;
    document.getElementById('word-text').value = '';
    document.getElementById('word-cat').value = '';
    document.getElementById('word-diff').value = 'mudah';
    document.getElementById('bank-form-title').textContent = 'Tambah Kata';
    document.getElementById('word-save').textContent = 'Tambah';
    document.getElementById('word-cancel').classList.add('hidden');
  },

  remove(id) {
    const w = Store.data.words.find(x => x.id === id);
    if (!w) return;
    if (!confirm(`Hapus kata "${w.text}"?`)) return;
    Store.data.words = Store.data.words.filter(x => x.id !== id);
    Store.save();
    if (this.editingId === id) this.resetForm();
    this.renderCats();
    this.renderList();
    updateHomeCounts();
    toast('Kata dihapus.');
  }
};
