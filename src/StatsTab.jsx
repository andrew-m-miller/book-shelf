function PubYearBarChart({ rows }) {
  const max = Math.max(...rows.map(r => r.value), 1)
  return (
    <div className="pub-year-chart">
      {rows.map((r, i) => (
        <div key={i} className="pyc-col">
          <div className="pyc-count">{r.value}</div>
          <div className="pyc-track">
            <div className="pyc-bar" style={{ height: `${r.value / max * 100}%` }} />
          </div>
          <div className="pyc-label">{r.label}</div>
        </div>
      ))}
    </div>
  )
}

function BarChart({ rows, wide }) {
  const max = Math.max(...rows.map(r => r.value), 1)
  return (
    <div className="chart">
      {rows.map((r, i) => (
        <div key={i} className={`chart-row${wide ? ' wide' : ''}`}>
          <div className="chart-label" title={r.label}>{r.label}</div>
          <div className="chart-track">
            <div className="chart-bar" style={{ width: `${r.value / max * 100}%` }} />
          </div>
          <div className="chart-value">{r.value}</div>
        </div>
      ))}
    </div>
  )
}

export default function StatsTab({ books }) {
  const readBooks = books.filter(b => b.status === 'read')

  // ── lifetime numbers ────────────────────────────────────────────────────────
  const totalPages = readBooks.reduce((s, b) => s + (b.pages || 0), 0)
  const rated      = readBooks.filter(b => b.rating > 0)
  const avgRating  = rated.length
    ? (rated.reduce((s, b) => s + b.rating, 0) / rated.length).toFixed(1)
    : '—'

  // ── by year ─────────────────────────────────────────────────────────────────
  const byYear = {}
  readBooks.forEach(b => {
    if (!b.date_finished) return
    const y = b.date_finished.slice(0, 4)
    byYear[y] = (byYear[y] || 0) + 1
  })
  const yearRows = Object.keys(byYear)
    .sort((a, b) => b - a)
    .map(y => ({ label: y, value: byYear[y] }))

  // ── by month (current year) ──────────────────────────────────────────────────
  const currentYear = String(new Date().getFullYear())
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const byMonth = Array(12).fill(0)
  readBooks.forEach(b => {
    if (!b.date_finished || !b.date_finished.startsWith(currentYear)) return
    const m = parseInt(b.date_finished.slice(5, 7), 10) - 1
    byMonth[m]++
  })
  const monthRows = MONTHS.map((label, i) => ({ label, value: byMonth[i] }))
    .filter((_, i) => i <= new Date().getMonth())

  // ── by publication year ──────────────────────────────────────────────────────
  const byPubYear = {}
  readBooks.forEach(b => {
    if (!b.year) return
    byPubYear[b.year] = (byPubYear[b.year] || 0) + 1
  })
  const pubYearRows = Object.keys(byPubYear)
    .sort((a, b) => Number(a) - Number(b))
    .map(y => ({ label: y, value: byPubYear[y] }))

  // ── by genre ─────────────────────────────────────────────────────────────────
  const byGenre = {}
  readBooks.forEach(b => { if (b.genre) byGenre[b.genre] = (byGenre[b.genre] || 0) + 1 })
  const genreRows = Object.entries(byGenre)
    .sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([label, value]) => ({ label, value }))

  // ── by author ────────────────────────────────────────────────────────────────
  const byAuthor = {}
  readBooks.forEach(b => { if (b.author) byAuthor[b.author] = (byAuthor[b.author] || 0) + 1 })
  const authorRows = Object.entries(byAuthor)
    .sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([label, value]) => ({ label, value }))

  // ── rating distribution ───────────────────────────────────────────────────────
  const ratingBuckets = {}
  rated.forEach(b => {
    const key = Number.isInteger(b.rating) ? String(b.rating) : b.rating.toFixed(1)
    ratingBuckets[key] = (ratingBuckets[key] || 0) + 1
  })
  const ratingRows = Object.keys(ratingBuckets)
    .sort((a, b) => b - a)
    .map(k => ({ label: `${k} ★`, value: ratingBuckets[k] }))

  if (!books.length) return <div className="empty" style={{ padding: '3rem 0' }}>No data yet — add some books to see stats.</div>

  return (
    <>
      <div className="stats-row" style={{ marginBottom: '2rem' }}>
        {[
          { label: 'Books read',   value: readBooks.length },
          { label: 'Pages read',   value: totalPages > 0 ? totalPages.toLocaleString() : '—' },
          { label: 'Avg rating',   value: avgRating },
          { label: 'Authors read', value: Object.keys(byAuthor).length || '—' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
          </div>
        ))}
      </div>

      {yearRows.length > 0 && (
        <section className="dash-section">
          <h2 className="dash-heading">Books read by year</h2>
          <BarChart rows={yearRows} />
        </section>
      )}

      {monthRows.some(r => r.value > 0) && (
        <section className="dash-section">
          <h2 className="dash-heading">Books finished in {currentYear}</h2>
          <BarChart rows={monthRows} />
        </section>
      )}

      {pubYearRows.length > 0 && (
        <section className="dash-section">
          <h2 className="dash-heading">Books by release year</h2>
          <PubYearBarChart rows={pubYearRows} />
        </section>
      )}

      {ratingRows.length > 0 && (
        <section className="dash-section">
          <h2 className="dash-heading">Rating distribution</h2>
          <BarChart rows={ratingRows} />
        </section>
      )}

      {genreRows.length > 0 && (
        <section className="dash-section">
          <h2 className="dash-heading">Top genres</h2>
          <BarChart rows={genreRows} wide />
        </section>
      )}

      {authorRows.length > 0 && (
        <section className="dash-section">
          <h2 className="dash-heading">Most-read authors</h2>
          <BarChart rows={authorRows} wide />
        </section>
      )}
    </>
  )
}
