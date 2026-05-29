import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabaseClient'
import './App.css'

// ─── helpers ────────────────────────────────────────────────────────────────

const STATUS_META = {
  read:    { label: 'Read',            cls: 'badge-read' },
  reading: { label: 'Currently reading', cls: 'badge-reading' },
  want:    { label: 'Want to read',    cls: 'badge-want' },
}

const EMPTY_FORM = {
  title: '', author: '', genre: '', status: 'want',
  rating: 0, notes: '', pages: '', pages_read: '',
  date_started: '', date_finished: '',
}

// ─── Book Search (Open Library + Google Books) ───────────────────────────────

async function searchExternalBooks(query) {
  const [olRes, gbRes] = await Promise.allSettled([
    fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=5&fields=key,title,author_name,number_of_pages_median,subject`)
      .then(r => r.json()),
    fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=5`)
      .then(r => r.json()),
  ])

  const results = []

  if (olRes.status === 'fulfilled' && olRes.value.docs) {
    olRes.value.docs.slice(0, 5).forEach(d => results.push({
      title:  d.title,
      author: (d.author_name || []).join(', '),
      pages:  d.number_of_pages_median || '',
      genre:  (d.subject || [])[0] || '',
      source: 'Open Library',
    }))
  }

  if (gbRes.status === 'fulfilled' && gbRes.value.items) {
    gbRes.value.items.slice(0, 5).forEach(d => {
      const v = d.volumeInfo
      results.push({
        title:  v.title,
        author: (v.authors || []).join(', '),
        pages:  v.pageCount || '',
        genre:  (v.categories || [])[0] || '',
        source: 'Google Books',
      })
    })
  }

  return results
}

// ─── Stars ───────────────────────────────────────────────────────────────────

function StarPicker({ value, onChange }) {
  return (
    <div className="star-picker">
      {[1, 2, 3, 4, 5].map(n => (
        <span
          key={n}
          className={`sp ${n <= value ? 'filled' : ''}`}
          onClick={() => onChange(n === value ? 0 : n)}
          role="button"
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
        >★</span>
      ))}
    </div>
  )
}

function StarDisplay({ value, onRate, bookId }) {
  return (
    <div className="stars">
      {[1, 2, 3, 4, 5].map(n => (
        <span
          key={n}
          className={`star ${n <= value ? 'filled' : ''}`}
          onClick={() => onRate(bookId, n)}
          role="button"
          aria-label={`Rate ${n} star${n > 1 ? 's' : ''}`}
        >★</span>
      ))}
    </div>
  )
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ pagesRead, pages }) {
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

// ─── Book Card ────────────────────────────────────────────────────────────────

function BookCard({ book, onEdit, onDelete, onRate }) {
  const meta = STATUS_META[book.status] || STATUS_META.want

  return (
    <div className="book-card">
      <div className="book-top">
        <div>
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
          {book.date_started && <span>Started {book.date_started}</span>}
          {book.date_finished && <span>Finished {book.date_finished}</span>}
        </div>
      )}

      {book.status === 'reading' && (
        <ProgressBar pagesRead={book.pages_read} pages={book.pages} />
      )}

      {book.notes && <div className="book-notes">{book.notes}</div>}

      <div className="book-actions">
        <button className="icon-btn" onClick={() => onEdit(book)} aria-label="Edit">✏️</button>
        <button className="icon-btn danger" onClick={() => onDelete(book.id)} aria-label="Delete">🗑</button>
      </div>
    </div>
  )
}

// ─── Import Search ────────────────────────────────────────────────────────────

function ImportSearch({ onImport }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [status, setStatus] = useState('')

  async function doSearch() {
    if (!query.trim()) return
    setStatus('Searching…')
    setResults([])
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
        <input
          type="text"
          placeholder="Title or author…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && doSearch()}
        />
        <button onClick={doSearch}>Search</button>
      </div>

      {status && <div className="import-status">{status}</div>}

      {results.length > 0 && (
        <div className="import-results">
          {results.map((r, i) => (
            <div key={i} className="import-result">
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

// ─── Book Form Modal ──────────────────────────────────────────────────────────

function BookModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || EMPTY_FORM)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function handleImport(result) {
    setForm(f => ({
      ...f,
      title:  result.title  || f.title,
      author: result.author || f.author,
      genre:  result.genre  || f.genre,
      pages:  result.pages  || f.pages,
    }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim()) return
    onSave({
      ...form,
      rating:     Number(form.rating) || 0,
      pages:      Number(form.pages)  || null,
      pages_read: Number(form.pages_read) || 0,
      date_started:  form.date_started  || null,
      date_finished: form.date_finished || null,
    })
  }

  const isEditing = !!initial?.id

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal">
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

          <div className="field-row">
            <div className="field">
              <label htmlFor="f-genre">Genre</label>
              <input id="f-genre" type="text" placeholder="Fiction, Sci-Fi…" value={form.genre} onChange={e => set('genre', e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="f-pages">Pages</label>
              <input id="f-pages" type="number" placeholder="Total pages" min="1" value={form.pages} onChange={e => set('pages', e.target.value)} />
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
      </div>
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [books, setBooks]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [filter, setFilter]     = useState('all')
  const [search, setSearch]     = useState('')
  const [modal, setModal]       = useState(null)   // null | 'add' | book object

  // ── fetch ──────────────────────────────────────────────────────────────────
  const fetchBooks = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('books')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setBooks(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchBooks() }, [fetchBooks])

  // ── save ───────────────────────────────────────────────────────────────────
  async function handleSave(form) {
    const { id, created_at, ...fields } = form

    if (id) {
      const { error } = await supabase.from('books').update(fields).eq('id', id)
      if (error) return alert('Save failed: ' + error.message)
    } else {
      const { error } = await supabase.from('books').insert(fields)
      if (error) return alert('Save failed: ' + error.message)
    }
    setModal(null)
    fetchBooks()
  }

  async function handleDelete(id) {
    if (!window.confirm('Remove this book?')) return
    const { error } = await supabase.from('books').delete().eq('id', id)
    if (error) return alert('Delete failed: ' + error.message)
    fetchBooks()
  }

  async function handleRate(id, rating) {
    await supabase.from('books').update({ rating }).eq('id', id)
    setBooks(bs => bs.map(b => b.id === id ? { ...b, rating } : b))
  }

  // ── derived ────────────────────────────────────────────────────────────────
  const filtered = books.filter(b => {
    if (filter !== 'all' && b.status !== filter) return false
    const q = search.toLowerCase()
    if (q && !b.title.toLowerCase().includes(q) && !(b.author || '').toLowerCase().includes(q)) return false
    return true
  })

  const readBooks = books.filter(b => b.status === 'read')
  const rated     = readBooks.filter(b => b.rating > 0)
  const avgRating = rated.length
    ? (rated.reduce((s, b) => s + b.rating, 0) / rated.length).toFixed(1)
    : '—'

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="app">
      <header className="header">
        <div>
          <div className="header-sub">my library</div>
          <h1>Reading Tracker</h1>
        </div>
        <button className="add-btn" onClick={() => setModal('add')}>+ Add book</button>
      </header>

      <div className="stats-row">
        {[
          { label: 'Total books',  value: books.length },
          { label: 'Finished',     value: readBooks.length },
          { label: 'Reading now',  value: books.filter(b => b.status === 'reading').length },
          { label: 'Avg rating',   value: avgRating },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="controls">
        {['all', 'read', 'reading', 'want'].map(f => (
          <button
            key={f}
            className={`filter-btn ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'All' : STATUS_META[f]?.label}
          </button>
        ))}
        <div className="search-wrap">
          <input
            type="text"
            placeholder="Search books…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading && <p className="loading-msg">Loading your library…</p>}
      {error   && <p className="error-msg">Error: {error}</p>}

      {!loading && !error && (
        <div className="book-grid">
          {filtered.length === 0
            ? <div className="empty">No books found</div>
            : filtered.map(b => (
                <BookCard
                  key={b.id}
                  book={b}
                  onEdit={setModal}
                  onDelete={handleDelete}
                  onRate={handleRate}
                />
              ))
          }
        </div>
      )}

      {modal && (
        <BookModal
          initial={modal === 'add' ? null : modal}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
