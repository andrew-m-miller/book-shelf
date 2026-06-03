import { useState, useMemo } from 'react'
import { STATUS_META, BookCard, BookRow, GridIcon, ListIcon } from './shared'

export default function LibraryTab({ books, loading, error, handleDelete, handleRate, setModal, onImportClick, onBackfillYears }) {
  const [filter,         setFilter]         = useState('all')
  const [search,         setSearch]         = useState('')
  const [view,           setView]           = useState('grid')
  const [sortBy,         setSortBy]         = useState('added_new')
  const [filterRating,   setFilterRating]   = useState('all')
  const [filterAuthor,   setFilterAuthor]   = useState('')
  const [filterYear,     setFilterYear]     = useState('')
  const [filterReadYear, setFilterReadYear] = useState('')

  // Option lists derived from the full book set
  const [backfilling,   setBackfilling]   = useState(false)
  const [backfillDone,  setBackfillDone]  = useState(0)
  const [backfillTotal, setBackfillTotal] = useState(0)

  const booksWithoutYear = useMemo(() => books.filter(b => !b.year && b.title).length, [books])

  async function startBackfill() {
    const total = booksWithoutYear
    setBackfilling(true); setBackfillDone(0); setBackfillTotal(total)
    await onBackfillYears((done) => setBackfillDone(done))
    setBackfilling(false)
  }

  const authors   = useMemo(() => [...new Set(books.map(b => b.author).filter(Boolean))].sort(), [books])
  const pubYears  = useMemo(() => [...new Set(books.map(b => b.year).filter(Boolean))].sort((a, b) => b - a), [books])
  const readYears = useMemo(() => [...new Set(books.map(b => b.date_finished?.slice(0, 4)).filter(Boolean))].sort((a, b) => b - a), [books])

  const filtered = useMemo(() => {
    let result = books.filter(b => {
      if (filter !== 'all' && b.status !== filter) return false
      const q = search.toLowerCase()
      if (q && !b.title.toLowerCase().includes(q) && !(b.author || '').toLowerCase().includes(q)) return false
      if (filterRating === 'unrated' && b.rating > 0) return false
      if (filterRating !== 'all' && filterRating !== 'unrated' && b.rating < parseFloat(filterRating)) return false
      if (filterAuthor && b.author !== filterAuthor) return false
      if (filterYear && String(b.year) !== filterYear) return false
      if (filterReadYear && !b.date_finished?.startsWith(filterReadYear)) return false
      return true
    })

    return [...result].sort((a, b) => {
      switch (sortBy) {
        case 'title_asc':   return (a.title  || '').localeCompare(b.title  || '')
        case 'title_desc':  return (b.title  || '').localeCompare(a.title  || '')
        case 'author_asc':  return (a.author || '').localeCompare(b.author || '')
        case 'author_desc': return (b.author || '').localeCompare(a.author || '')
        case 'rating_high': return (b.rating || 0) - (a.rating || 0)
        case 'rating_low':  return (a.rating || 0) - (b.rating || 0)
        case 'year_new':    return (b.year || 0) - (a.year || 0)
        case 'year_old':    return (a.year || 0) - (b.year || 0)
        case 'read_new':    return (b.date_finished || '').localeCompare(a.date_finished || '')
        case 'read_old':    return (a.date_finished || '').localeCompare(b.date_finished || '')
        case 'added_old':   return (a.created_at   || '').localeCompare(b.created_at   || '')
        default:            return 0 // added_new: preserve Supabase order
      }
    })
  }, [books, filter, search, sortBy, filterRating, filterAuthor, filterYear, filterReadYear])

  const hasActiveFilters = filterRating !== 'all' || filterAuthor || filterYear || filterReadYear

  function clearFilters() {
    setFilterRating('all')
    setFilterAuthor('')
    setFilterYear('')
    setFilterReadYear('')
  }

  return (
    <>
      <div className="lib-toolbar">
        <div className="header-actions">
          {backfilling ? (
            <span className="backfill-status">
              Looking up years… {backfillDone} / {backfillTotal}
            </span>
          ) : booksWithoutYear > 0 ? (
            <button className="import-btn" onClick={startBackfill}>
              Fetch {booksWithoutYear} missing year{booksWithoutYear !== 1 ? 's' : ''}
            </button>
          ) : null}
          <button className="import-btn" onClick={onImportClick}>Import CSV</button>
          <button className="add-btn" onClick={() => setModal('add')}>+ Add book</button>
        </div>
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
          <button className={`view-btn ${view === 'grid' ? 'active' : ''}`} onClick={() => setView('grid')} aria-label="Grid view"><GridIcon /></button>
          <button className={`view-btn ${view === 'list' ? 'active' : ''}`} onClick={() => setView('list')} aria-label="List view"><ListIcon /></button>
        </div>
      </div>

      <div className="sort-filter-row">
        <div className="sf-group">
          <label className="sf-label">Sort</label>
          <select className="sf-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="added_new">Date added: newest</option>
            <option value="added_old">Date added: oldest</option>
            <option value="title_asc">Title: A–Z</option>
            <option value="title_desc">Title: Z–A</option>
            <option value="author_asc">Author: A–Z</option>
            <option value="author_desc">Author: Z–A</option>
            <option value="rating_high">Rating: highest</option>
            <option value="rating_low">Rating: lowest</option>
            <option value="year_new">Release year: newest</option>
            <option value="year_old">Release year: oldest</option>
            <option value="read_new">Read date: newest</option>
            <option value="read_old">Read date: oldest</option>
          </select>
        </div>

        <div className="sf-group">
          <label className="sf-label">Rating</label>
          <select className="sf-select" value={filterRating} onChange={e => setFilterRating(e.target.value)}>
            <option value="all">Any</option>
            <option value="5">5★ only</option>
            <option value="4">4★ and up</option>
            <option value="3">3★ and up</option>
            <option value="2">2★ and up</option>
            <option value="1">1★ and up</option>
            <option value="unrated">Unrated</option>
          </select>
        </div>

        {authors.length > 0 && (
          <div className="sf-group">
            <label className="sf-label">Author</label>
            <select className="sf-select" value={filterAuthor} onChange={e => setFilterAuthor(e.target.value)}>
              <option value="">Any</option>
              {authors.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        )}

        {pubYears.length > 0 && (
          <div className="sf-group">
            <label className="sf-label">Published</label>
            <select className="sf-select" value={filterYear} onChange={e => setFilterYear(e.target.value)}>
              <option value="">Any year</option>
              {pubYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        )}

        {readYears.length > 0 && (
          <div className="sf-group">
            <label className="sf-label">Read in</label>
            <select className="sf-select" value={filterReadYear} onChange={e => setFilterReadYear(e.target.value)}>
              <option value="">Any year</option>
              {readYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        )}

        {hasActiveFilters && (
          <button className="clear-filters-btn" onClick={clearFilters}>Clear filters</button>
        )}
      </div>

      {loading && <p className="loading-msg">Loading your library…</p>}
      {error   && <p className="error-msg">Error: {error}</p>}

      {!loading && !error && (
        filtered.length === 0
          ? <div className="empty">No books found</div>
          : view === 'grid'
            ? <div className="book-grid">{filtered.map(b => <BookCard key={b.id} book={b} onEdit={setModal} onDelete={handleDelete} onRate={handleRate} />)}</div>
            : <div className="book-list">{filtered.map(b => <BookRow  key={b.id} book={b} onEdit={setModal} onDelete={handleDelete} onRate={handleRate} />)}</div>
      )}
    </>
  )
}
