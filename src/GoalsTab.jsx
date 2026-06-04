import { useState } from 'react'

// Goal type metadata — unit label + how the target is phrased.
const GOAL_TYPES = {
  books_per_year: { unit: 'books', noun: 'book',  verb: 'Read' },
  pages_per_year: { unit: 'pages', noun: 'page',  verb: 'Read' },
}

function yearProgress() {
  const now   = new Date()
  const start = new Date(now.getFullYear(), 0, 1).getTime()
  const end   = new Date(now.getFullYear() + 1, 0, 1).getTime()
  return (now.getTime() - start) / (end - start)
}

function fmt(n) { return n.toLocaleString() }

function GoalCard({ goal, current, onEdit, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(String(goal.target))
  const currentYear = new Date().getFullYear()
  const isPast = goal.year < currentYear
  const meta   = GOAL_TYPES[goal.type] || GOAL_TYPES.books_per_year

  const pct      = Math.min(100, Math.round(current / goal.target * 100))
  const complete = current >= goal.target
  const onTrack  = !isPast && !complete && current >= Math.floor(yearProgress() * goal.target)

  function saveEdit() {
    const t = parseInt(draft, 10)
    if (!t || t < 1) return
    onEdit(goal.id, t)
    setEditing(false)
  }

  let statusLabel = '', statusCls = ''
  if (complete)     { statusLabel = '🎉 Goal reached!'; statusCls = 'complete' }
  else if (isPast)  { statusLabel = `Reached ${fmt(current)} of ${fmt(goal.target)} ${meta.unit}`; statusCls = 'missed' }
  else if (onTrack) { statusLabel = 'On track';   statusCls = 'on-track' }
  else              { statusLabel = 'Behind pace'; statusCls = 'behind' }

  return (
    <div className="goal-card">
      <div className="goal-card-top">
        <div>
          <div className="goal-year">{goal.year} · {meta.unit}</div>
          {editing ? (
            <div className="goal-edit-row">
              <span>{meta.verb}</span>
              <input type="number" min="1" value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(false) }} autoFocus />
              <span>{meta.unit}</span>
              <button onClick={saveEdit}>Save</button>
              <button className="btn-cancel-sm" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          ) : (
            <div className="goal-desc">{meta.verb} {fmt(goal.target)} {meta.unit}</div>
          )}
        </div>
        {!isPast && !editing && (
          <div className="goal-actions">
            <button className="icon-btn" onClick={() => setEditing(true)} aria-label="Edit goal">✏️</button>
            <button className="icon-btn danger" onClick={() => onDelete(goal.id)} aria-label="Delete goal">🗑</button>
          </div>
        )}
        {isPast && (
          <button className="icon-btn danger" onClick={() => onDelete(goal.id)} aria-label="Delete goal">🗑</button>
        )}
      </div>

      <div className="progress-wrap">
        <div className="progress-label">
          <span>{fmt(current)} of {fmt(goal.target)} {meta.unit}</span>
          <span>{pct}%</span>
        </div>
        <div className="progress-bar-bg">
          <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className={`goal-status ${statusCls}`}>{statusLabel}</div>
    </div>
  )
}

function NewGoalForm({ year, availableTypes, onSave }) {
  const [type,   setType]   = useState(availableTypes[0])
  const [target, setTarget] = useState('')
  const meta = GOAL_TYPES[type]

  // Keep the selected type valid as goals get added.
  if (!availableTypes.includes(type)) setType(availableTypes[0])

  return (
    <div className="goal-empty">
      <p className="goal-empty-text">Set a reading goal for {year}.</p>
      <div className="set-goal-row">
        <span>{meta.verb}</span>
        <input
          type="number"
          min="1"
          value={target}
          onChange={e => setTarget(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && target && onSave(type, target)}
          placeholder={type === 'pages_per_year' ? '6000' : '20'}
        />
        {availableTypes.length > 1 ? (
          <select className="sf-select" value={type} onChange={e => setType(e.target.value)}>
            {availableTypes.map(t => <option key={t} value={t}>{GOAL_TYPES[t].unit}</option>)}
          </select>
        ) : (
          <span>{meta.unit}</span>
        )}
        <span>in {year}</span>
        <button
          className="add-btn"
          onClick={() => target && onSave(type, target)}
          disabled={!target}
        >Set goal</button>
      </div>
    </div>
  )
}

export default function GoalsTab({ books, goals, onAddGoal, onEditGoal, onDeleteGoal }) {
  const currentYear = new Date().getFullYear()

  const readInYear = year =>
    books.filter(b => b.status === 'read' && b.date_finished?.startsWith(String(year)))

  function progressFor(goal) {
    const read = readInYear(goal.year)
    return goal.type === 'pages_per_year'
      ? read.reduce((s, b) => s + (b.pages || 0), 0)
      : read.length
  }

  const currentGoals  = goals.filter(g => g.year === currentYear)
  const pastGoals     = goals.filter(g => g.year !== currentYear)
                             .sort((a, b) => b.year - a.year)
  const availableTypes = Object.keys(GOAL_TYPES)
    .filter(t => !currentGoals.some(g => g.type === t))

  return (
    <>
      <section className="dash-section">
        <h2 className="dash-heading">{currentYear} reading goals</h2>
        {currentGoals.map(g => (
          <GoalCard key={g.id} goal={g} current={progressFor(g)} onEdit={onEditGoal} onDelete={onDeleteGoal} />
        ))}
        {availableTypes.length > 0 && (
          <NewGoalForm
            year={currentYear}
            availableTypes={availableTypes}
            onSave={(type, target) => onAddGoal(type, parseInt(target, 10), currentYear)}
          />
        )}
      </section>

      {pastGoals.length > 0 && (
        <section className="dash-section">
          <h2 className="dash-heading">Past goals</h2>
          {pastGoals.map(g => (
            <GoalCard key={g.id} goal={g} current={progressFor(g)} onEdit={onEditGoal} onDelete={onDeleteGoal} />
          ))}
        </section>
      )}
    </>
  )
}
