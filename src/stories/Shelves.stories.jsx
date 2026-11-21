import React from 'react';

const meta = {
  title: 'Shelves/Дизайн-система',
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
};

export default meta;

export const Overview = {
  name: 'Обзор',
  render: () => (
    <main className="sb-showcase">
      <h1>Shelves<span style={{ color: 'var(--sb-coral)' }}>.</span></h1>
      <p className="sb-intro">Базовые цвета, типографика и элементы книжного трекера по DESIGN.md.</p>

      <section className="sb-section">
        <h2>Цвета</h2>
        <div className="sb-grid">
          <Swatch name="Основной текст" hex="#111111" color="#111111" text="#ffffff" />
          <Swatch name="Вторичный текст" hex="#777777" color="#777777" text="#ffffff" />
          <Swatch name="Разделитель" hex="#B8B8B8" color="#B8B8B8" />
          <Swatch name="Коралловый" hex="#FF7759" color="#FF7759" />
          <Swatch name="Индиго" hex="#5059D9" color="#5059D9" text="#ffffff" />
          <Swatch name="Розовый" hex="#F17FA4" color="#F17FA4" />
          <Swatch name="Жёлтый" hex="#F6BD59" color="#F6BD59" />
          <Swatch name="Бирюзовый" hex="#64BCAE" color="#64BCAE" />
          <Swatch name="Оценка" hex="#FFB64D" color="#FFB64D" />
        </div>
      </section>

      <section className="sb-section">
        <h2>Типографика</h2>
        <p style={{ marginBottom: 8, fontSize: 32, fontWeight: 500, letterSpacing: '-.055em' }}>Мои книги</p>
        <p style={{ marginBottom: 8, fontSize: 21, fontWeight: 500, letterSpacing: '-.045em' }}>Книжная полка</p>
        <p style={{ marginBottom: 8, fontSize: 16, fontWeight: 500 }}>Маленькая жизнь</p>
        <p style={{ marginBottom: 4, fontSize: 14, lineHeight: 1.5 }}>Основной текст и описание книги</p>
        <small style={{ color: 'var(--sb-muted)', fontSize: 12 }}>Подпись, автор и метаданные</small>
      </section>

      <section className="sb-section">
        <h2>Кнопки</h2>
        <div className="sb-row">
          <button className="button button-primary">Добавить книгу</button>
          <button className="button button-secondary">Отмена</button>
          <button className="button button-plain">Сбросить</button>
        </div>
      </section>

      <section className="sb-section">
        <h2>Статусы</h2>
        <div className="sb-statuses">
          <span className="sb-status">Читаю</span>
          <span className="sb-status">В планах</span>
          <span className="sb-status">Прочитано</span>
          <span className="sb-status">Отложено</span>
        </div>
      </section>

      <section className="sb-section">
        <h2>Книжная запись</h2>
        <BookSample color="indigo" title="Маленькая жизнь" author="Ханья Янагихара" status="Читаю" rating={4} />
      </section>

      <section className="sb-section">
        <h2>Поля</h2>
        <div className="sb-row" style={{ alignItems: 'flex-start' }}>
          <label className="sb-field">Название книги<input defaultValue="Маленькая жизнь" /></label>
          <label className="sb-field">Статус<select defaultValue="reading"><option value="reading">Читаю</option><option>В планах</option></select></label>
          <label className="sb-field">Впечатление<textarea defaultValue="История, к которой хочется возвращаться." /></label>
        </div>
      </section>
    </main>
  ),
};

function Swatch({ name, hex, color, text = '#111111' }) {
  return <div className="sb-swatch" style={{ color: text, background: color }}><strong>{name}</strong><span>{hex}</span></div>;
}

function BookSample({ color = 'coral', title = 'Новая книга', author = 'Имя автора', status = 'Прочитано', rating = 5 }) {
  return (
    <article className="sb-book-sample">
      <div className={`sb-book-cover ${color}`}>{title}</div>
      <div className="sb-book-info">
        <span className="status">{status}</span>
        <h3 style={{ marginTop: 10 }}>{title}</h3>
        <p>{author}</p>
        <div className="sb-rating" aria-label={`Оценка ${rating} из 5`}>{'★'.repeat(rating)}<span className="empty">{'★'.repeat(5 - rating)}</span></div>
      </div>
    </article>
  );
}

export const BookCoverColors = {
  name: 'Цвета обложек',
  render: () => <div className="sb-row">{['coral', 'indigo', 'pink', 'yellow', 'teal'].map((color) => <BookSample key={color} color={color} title="Цвет обложки" />)}</div>,
};

export const Statuses = {
  name: 'Статусы книги',
  render: () => <div className="sb-statuses">{['Читаю', 'В планах', 'Прочитано', 'Отложено'].map((status) => <span className="sb-status" key={status}>{status}</span>)}</div>,
};
