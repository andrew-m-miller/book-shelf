import { useState } from 'react'
import { ProgressBar, StarDisplay, StarPicker, Modal, handleImgError } from './shared'

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

function ReadingCard({ book, onUpdate, onEdit, onComplete }) {
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
          <img className="reading-cover" src={book.cover_url} alt={book.title} onError={handleImgError} />
        )}
        <div className="reading-info">
          <div className="reading-title">{book.title}</div>
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

function RecentRow({ book }) {
  return (
    <div className="recent-row">
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

export default function DashboardTab({ books, loading, handleProgressUpdate, handleMarkComplete, handleRate, setModal, pagesThisWeek }) {
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

  if (loading) return <p className="loading-msg">Loading…</p>

  return (
    <>
      <div className="stats-row">
        {[
          { label: 'Total read',        value: readBooks.length },
          { label: String(currentYear), value: readThisYear.length },
          { label: 'Reading now',       value: currentlyReading.length },
          { label: 'Avg rating',        value: avgRating },
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
            {recentlyFinished.map(b => <RecentRow key={b.id} book={b} />)}
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
