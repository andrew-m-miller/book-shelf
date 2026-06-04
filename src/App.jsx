import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from './supabaseClient'
import { goodreadsToBooks, lookupCoverByTitle, lookupPublicationYear } from './api'
import { BookModal, GoodreadsImportModal } from './shared'
import DashboardTab from './DashboardTab'
import LibraryTab   from './LibraryTab'
import GoalsTab     from './GoalsTab'
import StatsTab     from './StatsTab'
import './App.css'

const YEAR_BATCH   = 3
const COVER_BATCH  = 5
const INSERT_BATCH = 50

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'library',   label: 'Library'   },
  { id: 'goals',     label: 'Goals'     },
  { id: 'stats',     label: 'Stats'     },
]

export default function App() {
  const [tab, setTab]               = useState('dashboard')
  const [books, setBooks]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [modal, setModal]           = useState(null)      // null | 'add' | book object
  const [importData, setImportData] = useState(null)      // null | parsed books array
  const [pagesThisWeek, setPagesThisWeek] = useState(0)
  const importInputRef              = useRef(null)

  // ── data ────────────────────────────────────────────────────────────────────
  const fetchBooks = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('books').select('*').order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setBooks(data)
    setLoading(false)
  }, [])

  const fetchPagesThisWeek = useCallback(async () => {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data } = await supabase
      .from('reading_log').select('pages').gte('logged_at', since)
    if (data) setPagesThisWeek(data.reduce((s, r) => s + r.pages, 0))
  }, [])

  useEffect(() => { fetchBooks(); fetchPagesThisWeek() }, [fetchBooks, fetchPagesThisWeek])

  // ── handlers ─────────────────────────────────────────────────────────────────
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
    const { error } = await supabase.from('books').update({ rating }).eq('id', id)
    if (error) { alert('Rating failed: ' + error.message); return }
    setBooks(bs => bs.map(b => b.id === id ? { ...b, rating } : b))
  }

  async function handleProgressUpdate(id, pagesRead) {
    const prev  = books.find(b => b.id === id)?.pages_read || 0
    const delta = pagesRead - prev
    const { error } = await supabase.from('books').update({ pages_read: pagesRead }).eq('id', id)
    if (error) { alert('Update failed: ' + error.message); return }
    setBooks(bs => bs.map(b => b.id === id ? { ...b, pages_read: pagesRead } : b))
    if (delta > 0) {
      const { error: logErr } = await supabase.from('reading_log').insert({ book_id: id, pages: delta })
      if (!logErr) setPagesThisWeek(prev => prev + delta)
    }
  }

  async function handleMarkComplete(id, rating) {
    const book  = books.find(b => b.id === id)
    const today = new Date().toISOString().slice(0, 10)
    const fields = { status: 'read', date_finished: today }
    if (rating > 0) fields.rating = rating
    if (book?.pages) fields.pages_read = book.pages
    const { error } = await supabase.from('books').update(fields).eq('id', id)
    if (error) { alert('Failed: ' + error.message); return }
    // Log any untracked pages between last progress save and completion
    const delta = (book?.pages || 0) - (book?.pages_read || 0)
    if (delta > 0) {
      const { error: logErr } = await supabase.from('reading_log').insert({ book_id: id, pages: delta })
      if (!logErr) setPagesThisWeek(prev => prev + delta)
    }
    fetchBooks()
  }

  function handleCSVFile(e) {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const parsed = goodreadsToBooks(ev.target.result)
      if (!parsed.length) { alert('No books found. Make sure this is a Goodreads export CSV.'); return }
      setImportData(parsed)
    }
    reader.onerror = () => alert('Failed to read file.')
    reader.readAsText(file)
  }

  async function handleBackfillYears(onProgress) {
    const needsYear = books.filter(b => !b.year && b.title)
    let done = 0
    for (let i = 0; i < needsYear.length; i += YEAR_BATCH) {
      await Promise.all(needsYear.slice(i, i + YEAR_BATCH).map(async book => {
        const year = await lookupPublicationYear(book.title, book.author)
        if (year) {
          const { error } = await supabase.from('books').update({ year }).eq('id', book.id)
          if (!error) setBooks(bs => bs.map(b => b.id === book.id ? { ...b, year } : b))
        }
        onProgress(++done, needsYear.length)
      }))
    }
  }

  async function handleGoodreadsConfirm(books, onProgress) {
    const needsCover    = books.filter(b => !b.cover_url)
    const hasCoverLookups = needsCover.length > 0
    for (let i = 0; i < needsCover.length; i += COVER_BATCH) {
      const slice = needsCover.slice(i, i + COVER_BATCH)
      const urls  = await Promise.all(slice.map(b => lookupCoverByTitle(b.title, b.author)))
      urls.forEach((url, j) => { slice[j].cover_url = url })
      onProgress(Math.round(((i + slice.length) / needsCover.length) * 30), 'Finding covers…')
    }
    const base = hasCoverLookups ? 30 : 0
    for (let i = 0; i < books.length; i += INSERT_BATCH) {
      const batch = books.slice(i, i + INSERT_BATCH)
      const { error } = await supabase.from('books').insert(batch)
      if (error) { alert('Import failed: ' + error.message); return }
      onProgress(base + Math.round(((i + batch.length) / books.length) * (100 - base)), 'Saving to library…')
    }
    setImportData(null)
    fetchBooks()
  }

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <div className="app">
      <header className="header">
        <div className="header-sub">my library</div>
        <h1>Reading Tracker</h1>
      </header>

      <nav className="tab-nav">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`tab-btn ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >{t.label}</button>
        ))}
      </nav>

      {tab === 'dashboard' && (
        <DashboardTab
          books={books}
          loading={loading}
          handleProgressUpdate={handleProgressUpdate}
          handleMarkComplete={handleMarkComplete}
          handleRate={handleRate}
          setModal={setModal}
          pagesThisWeek={pagesThisWeek}
        />
      )}
      {tab === 'library' && (
        <LibraryTab
          books={books}
          loading={loading}
          error={error}
          handleDelete={handleDelete}
          handleRate={handleRate}
          setModal={setModal}
          onImportClick={() => importInputRef.current.click()}
          onBackfillYears={handleBackfillYears}
        />
      )}
      {tab === 'goals'  && <GoalsTab books={books} />}
      {tab === 'stats'  && <StatsTab books={books} />}

      {/* Hidden CSV input lives at app level so its ref is stable */}
      <input ref={importInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleCSVFile} />

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
