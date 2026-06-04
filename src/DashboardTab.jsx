import { useState, useMemo } from 'react'
import { ProgressBar, StarDisplay, StarPicker, Modal, handleImgError } from './shared'

// ─── Reading activity (streaks + heatmap) ─────────────────────────────────────

const DAY_MS = 86400000
const dayKey = d => d.toISOString().slice(0, 10)
const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// Merge logged page-deltas with finished-book dates into one day → pages map.
// Imported books predate the reading_log, so their finish dates still count.
function buildActivity(books, dailyPages) {
  const map = { ...dailyPages }
  books.forEach(b => {
    if (b.status === 'read' && b.date_finished && !(b.date_finished in map)) {
      map[b.date_finished] = b.pages || 0
    }
  })
  return map
}

function computeStreaks(activeSet) {
  if (!activeSet.size) return { current: 0, longest: 0 }
  const days = [...activeSet].sort()
  let longest = 1, run = 1
  for (let i = 1; i < days.length; i++) {
    const diff = Math.round((new Date(days[i] + 'T00:00:00Z') - new Date(days[i - 1] + 'T00:00:00Z')) / DAY_MS)
    run = diff === 1 ? run + 1 : 1
    if (run > longest) longest = run
  }
  // Current streak counts back from today; a blank today still allows a live
  // streak that ended yesterday.
  let cursor = new Date(dayKey(new Date()) + 'T00:00:00Z')
  if (!activeSet.has(dayKey(cursor))) cursor = new Date(+cursor - DAY_MS)
  let current = 0
  while (activeSet.has(dayKey(cursor))) { current++; cursor = new Date(+cursor - DAY_MS) }
  return { current, longest }
}

function intensity(pages, active) {
  if (!active) return 0
  if (pages < 30)  return 1
  if (pages < 75)  return 2
  if (pages < 150) return 3
  return 4
}

function ReadingHeatmap({ activity }) {
  const today    = new Date()
  const year     = today.getUTCFullYear()
  const todayKey = dayKey(today)

  // Grid spans the week containing Jan 1 through the week containing today.
  const jan1   = new Date(Date.UTC(year, 0, 1))
  const endKey = new Date(todayKey + 'T00:00:00Z')
  let cursor   = new Date(+jan1 - jan1.getUTCDay() * DAY_MS) // back to Sunday

  const weeks = []
  while (cursor <= endKey) {
    const week = []
    for (let i = 0; i < 7; i++) {
      const key = dayKey(cursor)
      week.push({
        key,
        month:  cursor.getUTCMonth(),
        inYear: cursor.getUTCFullYear() === year,
        future: key > todayKey,
        pages:  activity[key] || 0,
        active: key in activity,
      })
      cursor = new Date(+cursor + DAY_MS)
    }
    weeks.push(week)
  }

  // A month label sits above the first week that opens a new month.
  let lastMonth = -1
  const labels = weeks.map(week => {
    const m = week[0].month
    if (week[0].inYear && m !== lastMonth) { lastMonth = m; return MONTH_ABBR[m] }
    return ''
  })

  return (
    <div className="heatmap-scroll">
      <div className="heatmap-months">
        {labels.map((l, i) => <span key={i} className="hm-month">{l}</span>)}
      </div>
      <div className="heatmap-grid">
        {weeks.map((week, wi) => (
          <div key={wi} className="hm-col">
            {week.map(cell => {
              const shown = cell.inYear && !cell.future
              return (
                <div
                  key={cell.key}
                  className={`hm-cell ${shown ? `lvl-${intensity(cell.pages, cell.active)}` : 'hm-blank'}`}
                  title={shown ? `${cell.key}: ${cell.pages ? cell.pages + ' pages' : (cell.active ? 'read' : 'no reading')}` : ''}
                />
              )
            })}
          </div>
        ))}
      </div>
      <div className="heatmap-legend">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map(l => <span key={l} className={`hm-cell lvl-${l}`} />)}
        <span>More</span>
      </div>
    </div>
  )
}

// ─── Completion modal ─────────────────────────────────────────────────────────

function CompletionModal({ book, onConfirm, onClose }) {
  const [rating, setRating] = useState(book.rating || 0)
  return (
    <Modal>
      <h2>Finished!</h2>
      <p className="gr-sub">{book.title}</p>
      <div className="field" style={{ marginTop: '1rem' }}>
        <label>Your rating</label>
        <StarPicker value={rating} onChange={setRating} />
      </div>
      <div className="modal-actions">
        <button className="btn-cancel" onClick={onClose}>Cancel</button>
        <button className="btn-save" onClick={() => { onConfirm(book.id, rating); onClose() }}>
          Mark as read
        </button>
      </div>
    </Modal>
  )
}

// ─── Currently-reading card ───────────────────────────────────────────────────

function ReadingCard({ book, onUpdate, onEdit, onComplete, onOpen }) {
  const [input, setInput]   = useState(String(book.pages_read || 0))
  const [saving, setSaving] = useState(false)

  async function save() {
    const val = parseInt(input, 10)
    if (isNaN(val) || val < 0) return
    setSaving(true)
    await onUpdate(book.id, val)
    setSaving(false)
  }

  return (
    <div className="reading-card">
      <div className="reading-card-top">
        {book.cover_url && (
          <img className="reading-cover book-open" src={book.cover_url} alt={book.title} onError={handleImgError} onClick={() => onOpen?.(book)} />
        )}
        <div className="reading-info">
          <div className="reading-title book-open" onClick={() => onOpen?.(book)}>{book.title}</div>
          <div className="reading-author">{book.author}</div>
          <ProgressBar pagesRead={book.pages_read} pages={book.pages} />
        </div>
        <button className="icon-btn" onClick={() => onEdit(book)} aria-label="Edit">✏️</button>
      </div>
      <div className="reading-update">
        <span className="reading-update-label">Update progress</span>
        <input
          type="number"
          value={input}
          min="0"
          max={book.pages || undefined}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && save()}
        />
        {book.pages && <span className="reading-of">of {book.pages} pages</span>}
        <button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        <button className="btn-complete" onClick={() => onComplete(book)}>Finished</button>
      </div>
    </div>
  )
}

// ─── Rating bar chart ─────────────────────────────────────────────────────────

function RatingBarChart({ readBooks }) {
  const rated = readBooks.filter(b => b.rating > 0)
  if (!rated.length) return null

  const hasHalfStars = rated.some(b => b.rating % 1 !== 0)
  const slots = hasHalfStars
    ? [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]
    : [1, 2, 3, 4, 5]

  const counts = {}
  rated.forEach(b => { counts[b.rating] = (counts[b.rating] || 0) + 1 })
  const max = Math.max(...slots.map(r => counts[r] || 0), 1)

  return (
    <div className="rating-chart">
      {slots.map(r => {
        const n = counts[r] || 0
        return (
          <div key={r} className="rating-col">
            <div className="rating-col-count">{n > 0 ? n : ''}</div>
            <div className="rating-col-track">
              <div className="rating-col-bar" style={{ height: `${n / max * 100}%` }} />
            </div>
            <div className="rating-col-label">
              {r % 1 === 0 ? `${r}★` : r}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Recently finished row ────────────────────────────────────────────────────

function RecentRow({ book, onOpen }) {
  return (
    <div className="recent-row book-open" onClick={() => onOpen?.(book)}>
      {book.cover_url && (
        <img className="recent-cover" src={book.cover_url} alt={book.title} onError={handleImgError} />
      )}
      <div className="recent-info">
        <div className="recent-title">{book.title}</div>
        <div className="recent-author">{book.author}</div>
      </div>
      {book.rating > 0 && <StarDisplay value={book.rating} />}
      {book.date_finished && <span className="recent-date">{book.date_finished}</span>}
    </div>
  )
}

// ─── Dashboard tab ────────────────────────────────────────────────────────────

export default function DashboardTab({ books, loading, handleProgressUpdate, handleMarkComplete, handleRate, setModal, onOpen, pagesThisWeek, dailyPages }) {
  const [completing, setCompleting] = useState(null) // null | book object
  const currentYear = new Date().getFullYear()

  const readBooks        = books.filter(b => b.status === 'read')
  const readThisYear     = readBooks.filter(b => b.date_finished?.startsWith(String(currentYear)))
  const currentlyReading = books.filter(b => b.status === 'reading')
  const recentlyFinished = readBooks
    .filter(b => b.date_finished)
    .sort((a, b) => b.date_finished.localeCompare(a.date_finished))
    .slice(0, 5)

  const rated     = readBooks.filter(b => b.rating > 0)
  const avgRating = rated.length
    ? (rated.reduce((s, b) => s + b.rating, 0) / rated.length).toFixed(1)
    : '—'

  const activity = useMemo(() => buildActivity(books, dailyPages || {}), [books, dailyPages])
  const { current: streak, longest } = useMemo(
    () => computeStreaks(new Set(Object.keys(activity))), [activity])

  if (loading) return <p className="loading-msg">Loading…</p>

  return (
    <>
      <div className="stats-row stats-row-fit">
        {[
          { label: String(currentYear), value: readThisYear.length },
          { label: 'Reading now',       value: currentlyReading.length },
          { label: 'Avg rating',        value: avgRating },
          { label: 'Day streak',        value: streak },
          { label: 'Pages this week',   value: pagesThisWeek.toLocaleString() },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
          </div>
        ))}
      </div>

      <section className="dash-section">
        <div className="dash-section-header">
          <h2 className="dash-heading">Reading activity</h2>
          {longest > 0 && (
            <span className="activity-meta">
              {streak > 0 ? `${streak}-day streak` : 'No active streak'} · best {longest}
            </span>
          )}
        </div>
        <ReadingHeatmap activity={activity} />
      </section>

      <section className="dash-section">
        <div className="dash-section-header">
          <h2 className="dash-heading">Currently reading</h2>
          <button className="add-btn" onClick={() => setModal('add')}>+ Add book</button>
        </div>
        {currentlyReading.length === 0 && (
          <div className="empty" style={{ padding: '1.5rem 0' }}>No books in progress.</div>
        )}
        {currentlyReading.map(b => (
          <ReadingCard
            key={b.id}
            book={b}
            onUpdate={handleProgressUpdate}
            onEdit={setModal}
            onComplete={setCompleting}
            onOpen={onOpen}
          />
        ))}
      </section>

      <section className="dash-section">
        <h2 className="dash-heading">Ratings</h2>
        <RatingBarChart readBooks={readBooks} />
      </section>

      {recentlyFinished.length > 0 && (
        <section className="dash-section">
          <h2 className="dash-heading">Recently finished</h2>
          <div className="recent-list">
            {recentlyFinished.map(b => <RecentRow key={b.id} book={b} onOpen={onOpen} />)}
          </div>
        </section>
      )}

      {completing && (
        <CompletionModal
          book={completing}
          onConfirm={handleMarkComplete}
          onClose={() => setCompleting(null)}
        />
      )}
    </>
  )
}
