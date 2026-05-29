import { useState, useEffect, useCallback, useRef } from 'react'
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
  date_started: '', date_finished: '', cover_url: '',
}

// ─── Book Search (Open Library + Google Books) ───────────────────────────────

async function searchExternalBooks(query) {
  const [olRes, gbRes] = await Promise.allSettled([
    fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=5&fields=key,title,author_name,number_of_pages_median,subject,cover_i`)
      .then(r => r.json()),
    fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=5`)
      .then(r => r.json()),
  ])

  const results = []

  if (olRes.status === 'fulfilled' && olRes.value.docs) {
    olRes.value.docs.slice(0, 5).forEach(d => results.push({
      title:     d.title,
      author:    (d.author_name || []).join(', '),
      pages:     d.number_of_pages_median || '',
      genre:     (d.subject || [])[0] || '',
      cover_url: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : '',
      source:    'Open Library',
    }))
  }

  if (gbRes.status === 'fulfilled' && gbRes.value.items) {
    gbRes.value.items.slice(0, 5).forEach(d => {
      const v = d.volumeInfo
      results.push({
        title:     v.title,
        author:    (v.authors || []).join(', '),
        pages:     v.pageCount || '',
        genre:     (v.categories || [])[0] || '',
        cover_url: v.imageLinks?.thumbnail?.replace('http://', 'https://') || '',
        source:    'Google Books',
      })
    })
  }

  return results
}

// ─── Goodreads CSV ───────────────────────────────────────────────────────────

function parseCSV(text) {
  const rows = []
  let row = [], field = '', inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], next = text[i + 1]
    if (inQuotes) {
      if (ch === '"' && next === '"') { field += '"'; i++ }
      else if (ch === '"')            inQuotes = false
      else                            field += ch
    } else {
      if      (ch === '"')  inQuotes = true
      else if (ch === ',')  { row.push(field); field = '' }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && next === '\n') i++
        row.push(field); rows.push(row); row = []; field = ''
      } else field += ch
    }
  }
  if (row.length) { row.push(field); if (row.some(Boolean)) rows.push(row) }
  return rows
}

function goodreadsToBooks(text) {
  const rows = parseCSV(text)
  if (rows.length < 2) return []
  const headers = rows[0].map(h => h.trim())
  const statusMap = { 'read': 'read', 'currently-reading': 'reading', 'to-read': 'want' }
  const grDate = d => (d ? d.replace(/\//g, '-') : null)

  return rows.slice(1)
    .filter(r => r.some(Boolean))
    .map(row => {
      const g = {}
      headers.forEach((h, i) => { g[h] = (row[i] || '').trim() })

      const isbn13 = g['ISBN13'].replace(/[="]/g, '')
      const isbn   = g['ISBN'].replace(/[="]/g, '')
      const isbn_  = isbn13 || isbn
      const status = statusMap[g['Exclusive Shelf']] || 'want'

      const dateAdded    = grDate(g['Date Added'])
      const dateFinished = status === 'read' ? grDate(g['Date Read']) : null
      // Only use Date Added as start date if it's on or before Date Read
      // (books added retroactively have Date Added > Date Read and should be skipped)
      const dateStarted  = dateAdded && (!dateFinished || dateAdded <= dateFinished)
        ? dateAdded : null

      return {
        title:         g['Title'],
        author:        g['Author'],
        status,
        rating:        parseInt(g['My Rating'], 10) || 0,
        pages:         parseInt(g['Number of Pages'], 10) || null,
        notes:         g['My Review'] || '',
        date_started:  dateStarted,
        date_finished: dateFinished,
        cover_url:     isbn_ ? `https://covers.openlibrary.org/b/isbn/${isbn_}-M.jpg` : '',
      }
    })
    .filter(b => b.title)
}

async function lookupCoverByTitle(title, author) {
  try {
    const q = encodeURIComponent(`${title} ${author}`.trim())
    const { docs } = await fetch(
      `https://openlibrary.org/search.json?q=${q}&limit=1&fields=cover_i`
    ).then(r => r.json())
    const id = docs?.[0]?.cover_i
    return id ? `https://covers.openlibrary.org/b/id/${id}-M.jpg` : ''
  } catch {
    return ''
  }
}

// ─── View toggle icons ────────────────────────────────────────────────────────

const GridIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
    <rect x="0" y="0" width="6" height="6" rx="1"/>
    <rect x="8" y="0" width="6" height="6" rx="1"/>
    <rect x="0" y="8" width="6" height="6" rx="1"/>
    <rect x="8" y="8" width="6" height="6" rx="1"/>
  </svg>
)

const ListIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
    <rect x="0" y="1"  width="14" height="2.5" rx="1"/>
    <rect x="0" y="5.75" width="14" height="2.5" rx="1"/>
    <rect x="0" y="10.5" width="14" height="2.5" rx="1"/>
  </svg>
)

// ─── Stars ───────────────────────────────────────────────────────────────────

// 'filled' | 'half' | '' based on where pos falls relative to rating
function starCls(pos, rating) {
  if (rating >= pos)       return 'filled'
  if (rating >= pos - 0.5) return 'half'
  return ''
}

function StarPicker({ value, onChange }) {
  const [hovered, setHovered] = useState(null)
  const display = hovered ?? value

  return (
    <div className="star-picker">
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n} className="star-wrap">
          <span
            className="star-hit star-hit-l"
            onMouseEnter={() => setHovered(n - 0.5)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => onChange(n - 0.5 === value ? 0 : n - 0.5)}
          />
          <span
            className="star-hit star-hit-r"
            onMouseEnter={() => setHovered(n)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => onChange(n === value ? 0 : n)}
          />
          <span className={`sp ${starCls(n, display)}`}>★</span>
        </span>
      ))}
    </div>
  )
}

function StarDisplay({ value, onRate, bookId }) {
  const [hovered, setHovered] = useState(null)
  const display = hovered ?? value

  return (
    <div className="stars">
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n} className="star-wrap">
          <span
            className="star-hit star-hit-l"
            onMouseEnter={() => setHovered(n - 0.5)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => onRate(bookId, n - 0.5 === value ? 0 : n - 0.5)}
          />
          <span
            className="star-hit star-hit-r"
            onMouseEnter={() => setHovered(n)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => onRate(bookId, n === value ? 0 : n)}
          />
          <span className={`star ${starCls(n, display)}`}>★</span>
        </span>
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
        {book.cover_url
          ? <img className="book-cover" src={book.cover_url} alt="" onError={e => { e.target.style.display = 'none' }} />
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

// ─── Book Row (list view) ─────────────────────────────────────────────────────

function BookRow({ book, onEdit, onDelete, onRate }) {
  const meta = STATUS_META[book.status] || STATUS_META.want
  return (
    <div className="book-row">
      {book.cover_url
        ? <img className="row-cover" src={book.cover_url} alt="" onError={e => { e.target.style.display = 'none' }} />
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
              {r.cover_url
                ? <img className="import-cover" src={r.cover_url} alt="" onError={e => { e.target.style.display = 'none' }} />
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

// ─── Book Form Modal ──────────────────────────────────────────────────────────

function BookModal({ initial, onSave, onClose }) {
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

// ─── Goodreads Import Modal ───────────────────────────────────────────────────

function GoodreadsImportModal({ books, onConfirm, onClose }) {
  const [phase, setPhase]         = useState('preview')  // preview | importing | done
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
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal">

        {phase === 'preview' && (<>
          <h2>Import from Goodreads</h2>
          <p className="gr-sub">Found <strong>{books.length}</strong> books in your export.</p>
          <div className="gr-counts">
            {counts.read > 0 && (
              <div className="gr-count-row">
                <span className={`status-badge ${STATUS_META.read.cls}`}>{STATUS_META.read.label}</span>
                <span className="gr-count-num">{counts.read}</span>
              </div>
            )}
            {counts.reading > 0 && (
              <div className="gr-count-row">
                <span className={`status-badge ${STATUS_META.reading.cls}`}>{STATUS_META.reading.label}</span>
                <span className="gr-count-num">{counts.reading}</span>
              </div>
            )}
            {counts.want > 0 && (
              <div className="gr-count-row">
                <span className={`status-badge ${STATUS_META.want.cls}`}>{STATUS_META.want.label}</span>
                <span className="gr-count-num">{counts.want}</span>
              </div>
            )}
          </div>
          <p className="gr-note">
            Ratings and read dates are imported automatically. Cover images are fetched
            from Open Library — books with ISBNs resolve instantly; others are looked
            up by title.
          </p>
          <div className="modal-actions">
            <button className="btn-cancel" onClick={onClose}>Cancel</button>
            <button className="btn-save" onClick={startImport}>
              Import {books.length} book{books.length !== 1 ? 's' : ''}
            </button>
          </div>
        </>)}

        {phase === 'importing' && (<>
          <h2>Importing…</h2>
          <p className="gr-sub">{progLabel}</p>
          <div className="progress-wrap" style={{ marginTop: '1.25rem' }}>
            <div className="progress-label">
              <span>{progLabel}</span>
              <span>{pct}%</span>
            </div>
            <div className="progress-bar-bg">
              <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </>)}

        {phase === 'done' && (<>
          <h2>Import complete</h2>
          <p className="gr-sub">
            {books.length} book{books.length !== 1 ? 's' : ''} added to your library.
          </p>
          <div className="modal-actions">
            <button className="btn-save" onClick={onClose}>Done</button>
          </div>
        </>)}

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
  const [modal, setModal]       = useState(null)       // null | 'add' | book object
  const [importData, setImportData] = useState(null)   // null | parsed books array
  const [view, setView]         = useState('grid')     // 'grid' | 'list'
  const importInputRef          = useRef(null)

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

  function handleCSVFile(e) {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const parsed = goodreadsToBooks(ev.target.result)
      if (!parsed.length) {
        alert('No books found. Make sure this is a Goodreads export CSV.')
        return
      }
      setImportData(parsed)
    }
    reader.readAsText(file)
  }

  async function handleGoodreadsConfirm(books, onProgress) {
    const needsCover = books.filter(b => !b.cover_url)
    const hasCoverLookups = needsCover.length > 0

    // Phase 1 (0–30%): fetch covers for books without ISBN-derived URLs
    for (let i = 0; i < needsCover.length; i += 5) {
      const slice = needsCover.slice(i, i + 5)
      const urls = await Promise.all(slice.map(b => lookupCoverByTitle(b.title, b.author)))
      urls.forEach((url, j) => { slice[j].cover_url = url })
      onProgress(Math.round(((i + slice.length) / needsCover.length) * 30), 'Finding covers…')
    }

    // Phase 2 (30–100%, or 0–100% if no cover lookups): insert to Supabase
    const base = hasCoverLookups ? 30 : 0
    for (let i = 0; i < books.length; i += 50) {
      const batch = books.slice(i, i + 50)
      const { error } = await supabase.from('books').insert(batch)
      if (error) { alert('Import failed: ' + error.message); return }
      onProgress(
        base + Math.round(((i + batch.length) / books.length) * (100 - base)),
        'Saving to library…'
      )
    }

    setImportData(null)
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
        <div className="header-actions">
          <input
            ref={importInputRef}
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={handleCSVFile}
          />
          <button className="import-btn" onClick={() => importInputRef.current.click()}>
            Import CSV
          </button>
          <button className="add-btn" onClick={() => setModal('add')}>+ Add book</button>
        </div>
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
        <div className="filter-btns">
          {['all', 'read', 'reading', 'want'].map(f => (
            <button
              key={f}
              className={`filter-btn ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'All' : STATUS_META[f]?.label}
            </button>
          ))}
        </div>
        <div className="search-wrap">
          <input
            type="text"
            placeholder="Search books…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="view-toggle">
          <button
            className={`view-btn ${view === 'grid' ? 'active' : ''}`}
            onClick={() => setView('grid')}
            aria-label="Grid view"
          ><GridIcon /></button>
          <button
            className={`view-btn ${view === 'list' ? 'active' : ''}`}
            onClick={() => setView('list')}
            aria-label="List view"
          ><ListIcon /></button>
        </div>
      </div>

      {loading && <p className="loading-msg">Loading your library…</p>}
      {error   && <p className="error-msg">Error: {error}</p>}

      {!loading && !error && (
        filtered.length === 0
          ? <div className="empty">No books found</div>
          : view === 'grid'
            ? (
              <div className="book-grid">
                {filtered.map(b => (
                  <BookCard key={b.id} book={b} onEdit={setModal} onDelete={handleDelete} onRate={handleRate} />
                ))}
              </div>
            ) : (
              <div className="book-list">
                {filtered.map(b => (
                  <BookRow key={b.id} book={b} onEdit={setModal} onDelete={handleDelete} onRate={handleRate} />
                ))}
              </div>
            )
      )}

      {modal && (
        <BookModal
          initial={modal === 'add' ? null : modal}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      {importData && (
        <GoodreadsImportModal
          books={importData}
          onConfirm={handleGoodreadsConfirm}
          onClose={() => setImportData(null)}
        />
      )}
    </div>
  )
}
