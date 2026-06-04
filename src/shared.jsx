import { useState } from 'react'
import { searchExternalBooks } from './api'

// ─── Constants ────────────────────────────────────────────────────────────────

export const STATUS_META = {
  read:    { label: 'Read',              cls: 'badge-read'    },
  reading: { label: 'Currently reading', cls: 'badge-reading' },
  want:    { label: 'Want to read',      cls: 'badge-want'    },
}

export const EMPTY_FORM = {
  title: '', author: '', genre: '', status: 'want',
  rating: 0, notes: '', pages: '', pages_read: '',
  date_started: '', date_finished: '', cover_url: '', year: '',
}

// ─── Shared utilities ─────────────────────────────────────────────────────────

export const handleImgError = e => { e.target.style.display = 'none' }

// ─── Modal wrapper ────────────────────────────────────────────────────────────

export function Modal({ children }) {
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal">
        {children}
      </div>
    </div>
  )
}

// ─── View icons ───────────────────────────────────────────────────────────────

export const GridIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
    <rect x="0" y="0" width="6" height="6" rx="1"/>
    <rect x="8" y="0" width="6" height="6" rx="1"/>
    <rect x="0" y="8" width="6" height="6" rx="1"/>
    <rect x="8" y="8" width="6" height="6" rx="1"/>
  </svg>
)

export const ListIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
    <rect x="0" y="1"    width="14" height="2.5" rx="1"/>
    <rect x="0" y="5.75" width="14" height="2.5" rx="1"/>
    <rect x="0" y="10.5" width="14" height="2.5" rx="1"/>
  </svg>
)

// ─── Stars ────────────────────────────────────────────────────────────────────

export function starCls(pos, rating) {
  if (rating >= pos)       return 'filled'
  if (rating >= pos - 0.5) return 'half'
  return ''
}

export function StarPicker({ value, onChange }) {
  const [hovered, setHovered] = useState(null)
  const display = hovered ?? value
  return (
    <div className="star-picker">
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n} className="star-wrap">
          <span className="star-hit star-hit-l" onMouseEnter={() => setHovered(n - 0.5)} onMouseLeave={() => setHovered(null)} onClick={() => onChange(n - 0.5 === value ? 0 : n - 0.5)} />
          <span className="star-hit star-hit-r" onMouseEnter={() => setHovered(n)}       onMouseLeave={() => setHovered(null)} onClick={() => onChange(n === value ? 0 : n)} />
          <span className={`sp ${starCls(n, display)}`}>★</span>
        </span>
      ))}
    </div>
  )
}

// onRate is optional — omit for read-only display
export function StarDisplay({ value, onRate, bookId }) {
  const [hovered, setHovered] = useState(null)
  const display = onRate ? (hovered ?? value) : value
  return (
    <div className="stars">
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n} className="star-wrap">
          {onRate && <>
            <span className="star-hit star-hit-l" onMouseEnter={() => setHovered(n - 0.5)} onMouseLeave={() => setHovered(null)} onClick={() => onRate(bookId, n - 0.5 === value ? 0 : n - 0.5)} />
            <span className="star-hit star-hit-r" onMouseEnter={() => setHovered(n)}       onMouseLeave={() => setHovered(null)} onClick={() => onRate(bookId, n === value ? 0 : n)} />
          </>}
          <span className={`star ${starCls(n, display)}`}>★</span>
        </span>
      ))}
    </div>
  )
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

export function ProgressBar({ pagesRead, pages }) {
  if (!pages) return null
  const pct = Math.min(100, Math.round((pagesRead || 0) / pages * 100))
  return (
    <div className="progress-wrap">
      <div className="progress-label">
        <span>{pagesRead || 0} of {pages} pages</span>
        <span>{pct}%</span>
      </div>
      <div className="progress-bar-bg">
        <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ─── Book card (grid view) ────────────────────────────────────────────────────

export function BookCard({ book, onEdit, onDelete, onRate }) {
  const meta = STATUS_META[book.status] || STATUS_META.want
  return (
    <div className="book-card">
      <div className="book-top">
        {book.cover_url
          ? <img className="book-cover" src={book.cover_url} alt={book.title} onError={handleImgError} />
          : <div className="book-cover-placeholder" />
        }
        <div className="book-info">
          <div className="book-title">{book.title}</div>
          <div className="book-author">{book.author}</div>
        </div>
        <span className={`status-badge ${meta.cls}`}>{meta.label}</span>
      </div>
      <div className="book-meta">
        <StarDisplay value={book.rating || 0} onRate={onRate} bookId={book.id} />
        {book.genre && <span className="book-genre">{book.genre}</span>}
      </div>
      {(book.date_started || book.date_finished) && (
        <div className="book-dates">
          {book.date_started  && <span>Started {book.date_started}</span>}
          {book.date_finished && <span>Finished {book.date_finished}</span>}
        </div>
      )}
      {book.status === 'reading' && <ProgressBar pagesRead={book.pages_read} pages={book.pages} />}
      {book.notes && <div className="book-notes">{book.notes}</div>}
      <div className="book-actions">
        <button className="icon-btn" onClick={() => onEdit(book)} aria-label="Edit">✏️</button>
        <button className="icon-btn danger" onClick={() => onDelete(book.id)} aria-label="Delete">🗑</button>
      </div>
    </div>
  )
}

// ─── Book row (list view) ─────────────────────────────────────────────────────

export function BookRow({ book, onEdit, onDelete, onRate }) {
  const meta = STATUS_META[book.status] || STATUS_META.want
  return (
    <div className="book-row">
      {book.cover_url
        ? <img className="row-cover" src={book.cover_url} alt={book.title} onError={handleImgError} />
        : <div className="row-cover-placeholder" />
      }
      <div className="row-title">{book.title}</div>
      <div className="row-author">{book.author}</div>
      <span className={`status-badge ${meta.cls}`}>{meta.label}</span>
      <StarDisplay value={book.rating || 0} onRate={onRate} bookId={book.id} />
      <div className="row-actions">
        <button className="icon-btn" onClick={() => onEdit(book)} aria-label="Edit">✏️</button>
        <button className="icon-btn danger" onClick={() => onDelete(book.id)} aria-label="Delete">🗑</button>
      </div>
    </div>
  )
}

// ─── Import search (used inside BookModal) ────────────────────────────────────

export function ImportSearch({ onImport }) {
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState([])
  const [status, setStatus]   = useState('')

  async function doSearch() {
    if (!query.trim()) return
    setStatus('Searching…'); setResults([])
    try {
      const items = await searchExternalBooks(query.trim())
      setResults(items)
      setStatus(items.length ? '' : 'No results found.')
    } catch {
      setStatus('Search failed. Check your connection.')
    }
  }

  return (
    <div className="import-section">
      <label>Search to import from Open Library or Google Books</label>
      <div className="import-row">
        <input type="text" placeholder="Title or author…" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && doSearch()} />
        <button onClick={doSearch}>Search</button>
      </div>
      {status && <div className="import-status">{status}</div>}
      {results.length > 0 && (
        <div className="import-results">
          {results.map((r, i) => (
            <div key={i} className="import-result">
              {r.cover_url
                ? <img className="import-cover" src={r.cover_url} alt={r.title} onError={handleImgError} />
                : <div className="import-cover-placeholder" />
              }
              <div className="import-result-info">
                <div className="import-result-title">{r.title}</div>
                <div className="import-result-author">{r.author || 'Unknown'} · {r.source}</div>
              </div>
              <button onClick={() => { onImport(r); setResults([]); setQuery('') }}>Use</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Book form modal ──────────────────────────────────────────────────────────

export function BookModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || EMPTY_FORM)
  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function handleImport(result) {
    setForm(f => ({
      ...f,
      title:     result.title     || f.title,
      author:    result.author    || f.author,
      genre:     result.genre     || f.genre,
      pages:     result.pages     || f.pages,
      cover_url: result.cover_url || f.cover_url,
    }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim()) return
    onSave({
      ...form,
      rating:        Number(form.rating) || 0,
      pages:         form.pages      ? Number(form.pages)      : null,
      pages_read:    form.pages_read ? Number(form.pages_read) : 0,
      year:          form.year       ? Number(form.year)       : null,
      date_started:  form.date_started  || null,
      date_finished: form.date_finished || null,
    })
  }

  const isEditing = !!initial?.id
  return (
    <Modal>
      <h2>{isEditing ? 'Edit book' : 'Add book'}</h2>
      {!isEditing && <ImportSearch onImport={handleImport} />}
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="f-title">Title</label>
          <input id="f-title" type="text" placeholder="Book title" value={form.title} onChange={e => set('title', e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="f-author">Author</label>
          <input id="f-author" type="text" placeholder="Author name" value={form.author} onChange={e => set('author', e.target.value)} />
        </div>
        <div className="field-row three">
          <div className="field">
            <label htmlFor="f-genre">Genre</label>
            <input id="f-genre" type="text" placeholder="Fiction, Sci-Fi…" value={form.genre} onChange={e => set('genre', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="f-pages">Pages</label>
            <input id="f-pages" type="number" placeholder="Total pages" min="1" value={form.pages} onChange={e => set('pages', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="f-year">Year published</label>
            <input id="f-year" type="number" placeholder="e.g. 1985" min="1" max="2100" value={form.year || ''} onChange={e => set('year', e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="f-status">Status</label>
          <select id="f-status" value={form.status} onChange={e => set('status', e.target.value)}>
            <option value="want">Want to read</option>
            <option value="reading">Currently reading</option>
            <option value="read">Finished</option>
          </select>
        </div>
        {form.status !== 'want' && (
          <div className="field-row">
            <div className="field">
              <label htmlFor="f-date-started">Date started</label>
              <input id="f-date-started" type="date" value={form.date_started || ''} onChange={e => set('date_started', e.target.value)} />
            </div>
            {form.status === 'read' && (
              <div className="field">
                <label htmlFor="f-date-finished">Date finished</label>
                <input id="f-date-finished" type="date" value={form.date_finished || ''} onChange={e => set('date_finished', e.target.value)} />
              </div>
            )}
          </div>
        )}
        {form.status === 'reading' && (
          <div className="field">
            <label htmlFor="f-pages-read">Pages read</label>
            <input id="f-pages-read" type="number" placeholder="0" min="0" value={form.pages_read || ''} onChange={e => set('pages_read', e.target.value)} />
          </div>
        )}
        <div className="field">
          <label>Rating</label>
          <StarPicker value={form.rating || 0} onChange={v => set('rating', v)} />
        </div>
        <div className="field">
          <label htmlFor="f-notes">Notes / Review</label>
          <textarea id="f-notes" placeholder="What did you think?" value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-save">Save</button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Goodreads import modal ───────────────────────────────────────────────────

export function GoodreadsImportModal({ books, onConfirm, onClose }) {
  const [phase, setPhase]         = useState('preview')
  const [pct, setPct]             = useState(0)
  const [progLabel, setProgLabel] = useState('')

  const counts = {
    read:    books.filter(b => b.status === 'read').length,
    reading: books.filter(b => b.status === 'reading').length,
    want:    books.filter(b => b.status === 'want').length,
  }

  async function startImport() {
    setPhase('importing')
    await onConfirm(books, (p, label) => { setPct(p); setProgLabel(label) })
    setPhase('done')
  }

  return (
    <Modal>
      {phase === 'preview' && (<>
        <h2>Import from Goodreads</h2>
        <p className="gr-sub">Found <strong>{books.length}</strong> books in your export.</p>
        <div className="gr-counts">
          {counts.read > 0 && <div className="gr-count-row"><span className={`status-badge ${STATUS_META.read.cls}`}>{STATUS_META.read.label}</span><span className="gr-count-num">{counts.read}</span></div>}
          {counts.reading > 0 && <div className="gr-count-row"><span className={`status-badge ${STATUS_META.reading.cls}`}>{STATUS_META.reading.label}</span><span className="gr-count-num">{counts.reading}</span></div>}
          {counts.want > 0 && <div className="gr-count-row"><span className={`status-badge ${STATUS_META.want.cls}`}>{STATUS_META.want.label}</span><span className="gr-count-num">{counts.want}</span></div>}
        </div>
        <p className="gr-note">Ratings and read dates are imported automatically. Cover images are fetched from Open Library — books with ISBNs resolve instantly; others are looked up by title.</p>
        <div className="modal-actions">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button className="btn-save" onClick={startImport}>Import {books.length} book{books.length !== 1 ? 's' : ''}</button>
        </div>
      </>)}
      {phase === 'importing' && (<>
        <h2>Importing…</h2>
        <div className="progress-wrap" style={{ marginTop: '1.25rem' }}>
          <div className="progress-label"><span>{progLabel}</span><span>{pct}%</span></div>
          <div className="progress-bar-bg"><div className="progress-bar-fill" style={{ width: `${pct}%` }} /></div>
        </div>
      </>)}
      {phase === 'done' && (<>
        <h2>Import complete</h2>
        <p className="gr-sub">{books.length} book{books.length !== 1 ? 's' : ''} added to your library.</p>
        <div className="modal-actions"><button className="btn-save" onClick={onClose}>Done</button></div>
      </>)}
    </Modal>
  )
}
