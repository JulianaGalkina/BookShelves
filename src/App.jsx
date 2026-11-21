import { useEffect, useMemo, useRef, useState } from 'react';

const STORAGE_KEY = 'book-diary-v1';
const FOLDERS_STORAGE_KEY = 'book-diary-folders-v1';
const STATUSES = [
  { value: 'reading', label: 'Читаю' },
  { value: 'planned', label: 'В планах' },
  { value: 'read', label: 'Прочитано' },
  { value: 'paused', label: 'Отложено' },
];
const coverColorIndex = (id) => {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) hash = (hash * 31 + id.charCodeAt(index)) | 0;
  return (hash >>> 0) % 6;
};
const SORT_OPTIONS = [
  { value: 'title', label: 'По названию' },
  { value: 'author', label: 'По автору' },
  { value: 'finishedAt', label: 'По дате прочтения' },
  { value: 'addedAt', label: 'По дате добавления' },
  { value: 'rating', label: 'По рейтингу' },
];
const emptyForm = { title: '', author: '', status: 'reading', rating: '', impression: '', startedAt: '', finishedAt: '', folderId: '' };
const today = () => {
  const date = new Date();
  const localOffset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - localOffset).toISOString().slice(0, 10);
};
const formatDate = (value) => new Date(`${value}T00:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

function readBooks() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function readFolders() {
  try {
    const data = JSON.parse(localStorage.getItem(FOLDERS_STORAGE_KEY) || '[]');
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function bookCountLabel(count) {
  const lastTwo = count % 100;
  const last = count % 10;
  const noun = lastTwo >= 11 && lastTwo <= 14 ? 'книг' : last === 1 ? 'книга' : last >= 2 && last <= 4 ? 'книги' : 'книг';
  return `${count} ${noun}`;
}

function App() {
  const [books, setBooks] = useState(readBooks);
  const [folders, setFolders] = useState(readFolders);
  const [filter, setFilter] = useState('all');
  const [activeFolderId, setActiveFolderId] = useState('all');
  const [sortBy, setSortBy] = useState('addedAt');
  const [sortDirection, setSortDirection] = useState('desc');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState('');
  const [folderFormOpen, setFolderFormOpen] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState(null);
  const [folderName, setFolderName] = useState('');
  const [folderBookIds, setFolderBookIds] = useState([]);
  const [folderError, setFolderError] = useState('');
  const coverInputRef = useRef(null);
  const coverTargetId = useRef(null);
  const coverHoldTimer = useRef(null);
  const coverHoldTriggered = useRef(false);

  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(books)), [books]);
  useEffect(() => localStorage.setItem(FOLDERS_STORAGE_KEY, JSON.stringify(folders)), [folders]);

  const visibleBooks = useMemo(() => books
    .filter((book) => (filter === 'all' || book.status === filter)
      && (activeFolderId === 'all' || book.folderId === activeFolderId))
    .sort((left, right) => {
      let comparison = 0;
      if (sortBy === 'title' || sortBy === 'author') {
        comparison = (left[sortBy] || '').localeCompare(right[sortBy] || '', 'ru', { sensitivity: 'base', numeric: true });
      } else if (sortBy === 'rating') {
        const leftRating = Number(left.rating) || 0;
        const rightRating = Number(right.rating) || 0;
        if (!leftRating && rightRating) return 1;
        if (leftRating && !rightRating) return -1;
        comparison = leftRating - rightRating;
      } else {
        const leftValue = left[sortBy] || '';
        const rightValue = right[sortBy] || '';
        if (!leftValue && rightValue) return 1;
        if (leftValue && !rightValue) return -1;
        comparison = leftValue.localeCompare(rightValue);
      }
      if (comparison === 0) return (left.title || '').localeCompare(right.title || '', 'ru', { sensitivity: 'base' });
      return sortDirection === 'asc' ? comparison : -comparison;
    }), [books, filter, activeFolderId, sortBy, sortDirection]);

  const folderCounts = useMemo(() => folders.map((folder) => ({
    ...folder,
    count: books.filter((book) => book.folderId === folder.id).length,
  })), [folders, books]);
  const activeFolder = folderCounts.find((folder) => folder.id === activeFolderId);

  function openNew() {
    setEditingId(null);
    setForm({ ...emptyForm, folderId: activeFolderId === 'all' ? '' : activeFolderId });
    setError('');
    setFormOpen(true);
  }

  function openEdit(book) {
    setEditingId(book.id);
    setForm({ ...emptyForm, ...book, folderId: book.folderId || '', rating: book.status === 'planned' ? '' : (book.rating || '') });
    setError('');
    setFormOpen(true);
  }

  function updateField(field, value) {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === 'status') {
        if (value === 'read' && current.status !== 'read' && !current.finishedAt) next.finishedAt = today();
        if (value !== 'read') next.finishedAt = '';
        if (value === 'planned') {
          next.startedAt = '';
          next.rating = '';
        }
      }
      return next;
    });
  }

  function saveBook(event) {
    event.preventDefault();
    if (!form.title.trim() || !form.author.trim()) {
      setError('Укажите название книги и автора.');
      return;
    }
    const existingBook = books.find((book) => book.id === editingId);
    const saved = {
      id: editingId || crypto.randomUUID(),
      title: form.title.trim(),
      author: form.author.trim(),
      status: form.status,
      rating: form.status !== 'planned' && form.rating !== '' ? Number(form.rating) : '',
      impression: form.impression.trim(),
      startedAt: ['reading', 'read'].includes(form.status) ? form.startedAt : '',
      finishedAt: form.status === 'read' ? (form.finishedAt || today()) : '',
      folderId: folders.some((folder) => folder.id === form.folderId) ? form.folderId : '',
      addedAt: existingBook?.addedAt || (editingId ? '' : new Date().toISOString()),
      coverImage: existingBook?.coverImage || '',
    };
    setBooks((current) => editingId ? current.map((book) => book.id === editingId ? saved : book) : [saved, ...current]);
    setFormOpen(false);
  }

  function openFolderForm(folder = null) {
    setEditingFolderId(folder?.id || null);
    setFolderName(folder?.name || '');
    setFolderBookIds(folder ? books.filter((book) => book.folderId === folder.id).map((book) => book.id) : []);
    setFolderError('');
    setFolderFormOpen(true);
  }

  function saveFolder(event) {
    event.preventDefault();
    const name = folderName.trim();
    if (!name) {
      setFolderError('Введите название папки.');
      return;
    }
    if (folders.some((folder) => folder.id !== editingFolderId && folder.name.toLocaleLowerCase('ru') === name.toLocaleLowerCase('ru'))) {
      setFolderError('Папка с таким названием уже есть.');
      return;
    }
    const folderId = editingFolderId || crypto.randomUUID();
    const folder = { id: folderId, name };
    setFolders((current) => editingFolderId
      ? current.map((item) => item.id === folderId ? folder : item)
      : [...current, folder]);
    setBooks((current) => current.map((book) => {
      if (folderBookIds.includes(book.id)) return { ...book, folderId };
      if (editingFolderId && book.folderId === folderId) return { ...book, folderId: '' };
      return book;
    }));
    if (!editingFolderId) setActiveFolderId(folderId);
    setFolderName('');
    setFolderBookIds([]);
    setFolderError('');
    setFolderFormOpen(false);
  }

  function removeFolder(folder) {
    if (!window.confirm(`Удалить папку «${folder.name}»? Книги останутся в трекере без папки.`)) return;
    setFolders((current) => current.filter((item) => item.id !== folder.id));
    setBooks((current) => current.map((book) => book.folderId === folder.id ? { ...book, folderId: '' } : book));
    if (activeFolderId === folder.id) setActiveFolderId('all');
  }

  function exportData() {
    const csvCell = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const rows = [
      ['ID', 'Название', 'Автор', 'Статус', 'Оценка', 'Впечатление', 'Папка', 'Начало чтения', 'Дата прочтения', 'Дата добавления'],
      ...books.map((book) => [
        book.id,
        book.title,
        book.author,
        STATUSES.find((status) => status.value === book.status)?.label || book.status,
        book.rating,
        book.impression,
        folders.find((folder) => folder.id === book.folderId)?.name || '',
        book.startedAt,
        book.finishedAt,
        book.addedAt,
      ]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `shelves-books-${today()}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function removeBook(book) {
    if (window.confirm(`Удалить «${book.title}» из трекера?`)) {
      setBooks((current) => current.filter((item) => item.id !== book.id));
    }
  }

  function openCoverPicker(bookId) {
    coverTargetId.current = bookId;
    coverInputRef.current?.click();
  }

  function startCoverHold(bookId) {
    clearTimeout(coverHoldTimer.current);
    coverHoldTriggered.current = false;
    coverTargetId.current = bookId;
    coverHoldTimer.current = setTimeout(() => {
      coverHoldTriggered.current = true;
    }, 600);
  }

  function finishCoverHold(bookId) {
    clearTimeout(coverHoldTimer.current);
    coverHoldTimer.current = null;
    if (coverHoldTriggered.current) {
      coverTargetId.current = bookId;
      coverInputRef.current?.click();
    }
  }

  function cancelCoverHold() {
    clearTimeout(coverHoldTimer.current);
    coverHoldTimer.current = null;
    coverHoldTriggered.current = false;
  }

  function handleCoverImageChange(event) {
    const file = event.target.files?.[0];
    const bookId = coverTargetId.current;
    event.target.value = '';
    if (!file || !bookId || !file.type.startsWith('image/')) return;

    const imageUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const maxWidth = 420;
      const maxHeight = 630;
      const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d');
      if (context) {
        context.fillStyle = '#fff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const coverImage = canvas.toDataURL('image/jpeg', 0.78);
        setBooks((current) => current.map((book) => book.id === bookId ? { ...book, coverImage } : book));
      }
      URL.revokeObjectURL(imageUrl);
      coverTargetId.current = null;
    };
    image.onerror = () => {
      URL.revokeObjectURL(imageUrl);
      coverTargetId.current = null;
    };
    image.src = imageUrl;
  }

  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Книжный трекер Shelves — главная">
          <span>Shelves</span>
        </a>
        <span className="private-note"><span className="lock" aria-hidden="true">●</span> Личное пространство</span>
      </header>

      <section className="library" aria-label="Список книг">
        <div className="library-heading">
          <h2>Каталог</h2>
          <div className="library-controls">
            <button className="button button-primary add-top" onClick={openNew}><span className="plus">＋</span> Добавить книгу</button>
            <div className="library-secondary-controls">
              <label className="filter-wrap"><span className="sr-only">Фильтр по статусу</span>
                <select value={filter} onChange={(event) => setFilter(event.target.value)}>
                  <option value="all">Все книги</option>
                  {STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                </select>
                <span className="select-arrow" aria-hidden="true">⌄</span>
              </label>
              <label className="sort-wrap"><span className="sr-only">Сортировка книг</span>
                <select value={sortBy} onChange={(event) => {
                  const nextSort = event.target.value;
                  setSortBy(nextSort);
                  setSortDirection(['title', 'author'].includes(nextSort) ? 'asc' : 'desc');
                }}>
                  {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <span className="select-arrow" aria-hidden="true">⌄</span>
              </label>
              <button
                className="sort-direction"
                type="button"
                aria-label={sortDirection === 'asc' ? 'Сначала по возрастанию' : 'Сначала по убыванию'}
                title={sortDirection === 'asc' ? 'По возрастанию' : 'По убыванию'}
                onClick={() => setSortDirection((current) => current === 'asc' ? 'desc' : 'asc')}
              >{sortDirection === 'asc' ? '↑' : '↓'}</button>
            </div>
          </div>
        </div>

        <section className="folder-section" aria-label="Папки книг">
          <div className="folder-heading">
            <h3>Папки</h3>
            <button type="button" className="folder-add" onClick={() => openFolderForm()}>＋ Новая папка</button>
          </div>
          <div className="folder-grid">
            <div className={`folder-card${activeFolderId === 'all' ? ' is-active' : ''}`}>
              <button type="button" className="folder-select" onClick={() => setActiveFolderId('all')}>
                <span className="folder-name">Все книги</span>
                <span className="folder-count">{bookCountLabel(books.length)}</span>
              </button>
            </div>
            {folderCounts.map((folder) => <div key={folder.id} className={`folder-card${activeFolderId === folder.id ? ' is-active' : ''}`}>
              <button type="button" className="folder-select" onClick={() => setActiveFolderId(folder.id)}>
                <span className="folder-name">{folder.name}</span>
                <span className="folder-count">{bookCountLabel(folder.count)}</span>
              </button>
            </div>)}
          </div>
          <div className="active-folder-row">
            <h3>{activeFolder?.name || 'Все книги'}</h3>
            {activeFolder && <div className="active-folder-actions">
              <button type="button" onClick={() => openFolderForm(activeFolder)}>Изменить</button>
              <button type="button" className="folder-delete" onClick={() => removeFolder(activeFolder)}>Удалить папку</button>
            </div>}
          </div>
        </section>

        {visibleBooks.length ? <div className="book-list">
          {visibleBooks.map((book) => {
            const status = STATUSES.find((item) => item.value === book.status);
            return <article className="book-card" key={book.id}>
              <button
                type="button"
                className={`book-cover book-cover-${coverColorIndex(book.id)}`}
                style={book.coverImage ? { backgroundImage: `url(${book.coverImage})` } : undefined}
                aria-label={`Изменить обложку книги «${book.title}»`}
                title="Нажмите или удерживайте, чтобы выбрать фото"
                onPointerDown={() => startCoverHold(book.id)}
                onPointerUp={() => finishCoverHold(book.id)}
                onPointerCancel={cancelCoverHold}
                onPointerLeave={cancelCoverHold}
                onContextMenu={(event) => event.preventDefault()}
                onClick={() => {
                  if (coverHoldTriggered.current) {
                    coverHoldTriggered.current = false;
                    return;
                  }
                  openCoverPicker(book.id);
                }}
              >
                {!book.coverImage && <span className="book-cover-title">{book.title}</span>}
              </button>
              <div className="book-info">
                <div className="book-card-top">
                <span className={`status status-${book.status}`}>{status?.label}</span>
                <div className="book-actions"><button onClick={() => openEdit(book)} aria-label={`Редактировать ${book.title}`} title="Редактировать">Изменить</button><button className="delete-action" onClick={() => removeBook(book)} aria-label={`Удалить ${book.title}`} title="Удалить">Удалить</button></div>
                </div>
                <div className="book-main">
                  <h3>{book.title}</h3>
                  <p className="author">{book.author}</p>
                  {book.impression && <p className="impression">“{book.impression}”</p>}
                  <div className="book-meta">
                    {book.status !== 'planned' && book.rating && <span className="rating" aria-label={`Оценка ${book.rating} из 5`}>{'★'.repeat(book.rating)}<span>{'★'.repeat(5 - book.rating)}</span></span>}
                    {book.status === 'reading' && book.startedAt && <span className="finished-date">Начало чтения {formatDate(book.startedAt)}</span>}
                    {book.status === 'read' && book.startedAt && <span className="finished-date">Начало чтения {formatDate(book.startedAt)}</span>}
                    {book.status === 'read' && book.finishedAt && <span className="finished-date">Завершена {formatDate(book.finishedAt)}</span>}
                  </div>
                </div>
              </div>
            </article>;
          })}
        </div> : <div className="empty-state">
          <div className="empty-icon" aria-hidden="true">✳</div>
          <h3>{books.length ? 'В этом разделе пока пусто' : 'Ваша первая книга начинается здесь'}</h3>
          <p>{books.length ? (activeFolderId === 'all' ? 'Выберите другой статус или добавьте книгу.' : 'Добавьте книгу в эту папку или выберите другую.') : 'Добавьте книгу, чтобы сохранить её в трекере.'}</p>
          {!books.length && <button className="button button-secondary" onClick={openNew}><span className="plus">＋</span> Добавить первую книгу</button>}
        </div>}
      </section>

      <footer className="footer"><div className="footer-notes"><span>Ваш трекер — только для вас</span><span>Сохраняется в этом браузере</span></div><button type="button" className="footer-export" onClick={exportData}>Экспорт CSV</button></footer>

      <input ref={coverInputRef} className="cover-file-input" type="file" accept="image/*" onChange={handleCoverImageChange} aria-label="Выбрать фото для обложки" />

      {formOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setFormOpen(false); }}>
        <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
          <div className="dialog-heading"><div><span className="section-kicker">КНИЖНЫЙ ТРЕКЕР</span><h2 id="dialog-title">{editingId ? 'Изменить книгу' : 'Новая книга'}</h2></div><button className="close-button" onClick={() => setFormOpen(false)} aria-label="Закрыть">×</button></div>
          <form onSubmit={saveBook}>
            <label className="field">Название книги<input autoFocus value={form.title} onChange={(event) => updateField('title', event.target.value)} placeholder="Например, Маленькая жизнь" /></label>
            <label className="field">Автор<input value={form.author} onChange={(event) => updateField('author', event.target.value)} placeholder="Имя автора" /></label>
            <div className={`field-row${form.status === 'planned' ? ' field-row-single' : ''}`}>
              <label className="field">Статус<select value={form.status} onChange={(event) => updateField('status', event.target.value)}>{STATUSES.map((status) => <option value={status.value} key={status.value}>{status.label}</option>)}</select></label>
              {form.status !== 'planned' && <label className="field">Оценка<select value={form.rating} onChange={(event) => updateField('rating', event.target.value)}><option value="">Без оценки</option>{[5, 4, 3, 2, 1].map((value) => <option value={value} key={value}>{value} из 5</option>)}</select></label>}
            </div>
            <label className="field">Папка<select value={form.folderId} onChange={(event) => updateField('folderId', event.target.value)}><option value="">Без папки</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label>
            {['reading', 'read'].includes(form.status) && <label className="field">Начало чтения<input type="date" value={form.startedAt} onChange={(event) => updateField('startedAt', event.target.value)} /></label>}
            {form.status === 'read' && <label className="field">Дата завершения<input type="date" value={form.finishedAt || today()} onChange={(event) => updateField('finishedAt', event.target.value)} /></label>}
            <label className="field">Впечатление<textarea value={form.impression} onChange={(event) => updateField('impression', event.target.value)} placeholder="Что хочется запомнить об этой книге?" rows="4" /></label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="form-actions"><button type="button" className="button button-plain" onClick={() => setFormOpen(false)}>Отмена</button><button type="submit" className="button button-primary">Сохранить книгу</button></div>
          </form>
        </section>
      </div>}

      {folderFormOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setFolderFormOpen(false); }}>
        <section className="dialog folder-dialog" role="dialog" aria-modal="true" aria-labelledby="folder-dialog-title">
          <div className="dialog-heading"><div><span className="section-kicker">КАТАЛОГ</span><h2 id="folder-dialog-title">{editingFolderId ? 'Переименовать папку' : 'Новая папка'}</h2></div><button className="close-button" onClick={() => setFolderFormOpen(false)} aria-label="Закрыть">×</button></div>
          <form onSubmit={saveFolder}>
            <label className="field">Название папки<input autoFocus value={folderName} onChange={(event) => setFolderName(event.target.value)} placeholder="Например, Фантастика" /></label>
            <fieldset className="folder-book-picker">
              <legend>Книги в папке</legend>
              <p>{editingFolderId ? 'Выберите книги, которые должны остаться в этой папке.' : 'Можно сразу добавить книги в новую папку.'}</p>
              {books.length ? <div className="folder-book-list">{books.map((book) => <label className="folder-book-option" key={book.id}>
                <input type="checkbox" checked={folderBookIds.includes(book.id)} onChange={(event) => setFolderBookIds((current) => event.target.checked ? [...current, book.id] : current.filter((id) => id !== book.id))} />
                <span>{book.title} <span className="folder-book-author">— {book.author}</span></span>
              </label>)}</div> : <p className="folder-book-empty">Сначала добавьте книги в каталог.</p>}
            </fieldset>
            {folderError && <p className="form-error" role="alert">{folderError}</p>}
            <div className="form-actions"><button type="button" className="button button-plain" onClick={() => setFolderFormOpen(false)}>Отмена</button><button type="submit" className="button button-primary">{editingFolderId ? 'Сохранить' : 'Создать папку'}</button></div>
          </form>
        </section>
      </div>}
    </main>
  );
}

export default App;
