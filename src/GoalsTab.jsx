import { useState } from 'react'

function yearProgress() {
  const now   = new Date()
  const start = new Date(now.getFullYear(), 0, 1).getTime()
  const end   = new Date(now.getFullYear() + 1, 0, 1).getTime()
  return (now.getTime() - start) / (end - start)
}

function GoalCard({ goal, booksRead, onEdit, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(String(goal.target))
  const currentYear = new Date().getFullYear()
  const isPast = goal.year < currentYear

  const pct      = Math.min(100, Math.round(booksRead / goal.target * 100))
  const complete  = booksRead >= goal.target
  const onTrack   = !isPast && !complete && booksRead >= Math.floor(yearProgress() * goal.target)

  function saveEdit() {
    const t = parseInt(draft, 10)
    if (!t || t < 1) return
    onEdit(goal.id, t)
    setEditing(false)
  }

  let statusLabel = '', statusCls = ''
  if (complete)      { statusLabel = '🎉 Goal reached!'; statusCls = 'complete' }
  else if (isPast)   { statusLabel = `Finished ${booksRead} of ${goal.target}`; statusCls = 'missed' }
  else if (onTrack)  { statusLabel = 'On track';  statusCls = 'on-track' }
  else               { statusLabel = 'Behind pace'; statusCls = 'behind' }

  return (
    <div className="goal-card">
      <div className="goal-card-top">
        <div>
          <div className="goal-year">{goal.year}</div>
          {editing ? (
            <div className="goal-edit-row">
              <span>Read</span>
              <input type="number" min="1" value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(false) }} autoFocus />
              <span>books</span>
              <button onClick={saveEdit}>Save</button>
              <button className="btn-cancel-sm" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          ) : (
            <div className="goal-desc">Read {goal.target} books</div>
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
          <span>{booksRead} of {goal.target} books</span>
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

function NewGoalForm({ year, onSave }) {
  const [target, setTarget] = useState('')
  return (
    <div className="goal-empty">
      <p className="goal-empty-text">No goal set for {year} yet.</p>
      <div className="set-goal-row">
        <span>Read</span>
        <input
          type="number"
          min="1"
          value={target}
          onChange={e => setTarget(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && target && onSave(target)}
          placeholder="20"
        />
        <span>books in {year}</span>
        <button
          className="add-btn"
          onClick={() => target && onSave(target)}
          disabled={!target}
        >Set goal</button>
      </div>
    </div>
  )
}

export default function GoalsTab({ books }) {
  const currentYear = new Date().getFullYear()

  const [goals, setGoals] = useState(() => {
    try { return JSON.parse(localStorage.getItem('bs_goals') || '[]') }
    catch { return [] }
  })

  function persist(updated) {
    setGoals(updated)
    localStorage.setItem('bs_goals', JSON.stringify(updated))
  }

  function addGoal(target) {
    persist([...goals, { id: Date.now(), type: 'books_per_year', target: parseInt(target, 10), year: currentYear }])
  }

  function editGoal(id, target) {
    persist(goals.map(g => g.id === id ? { ...g, target } : g))
  }

  function deleteGoal(id) {
    persist(goals.filter(g => g.id !== id))
  }

  function booksReadInYear(year) {
    return books.filter(b => b.status === 'read' && b.date_finished?.startsWith(String(year))).length
  }

  const currentGoal = goals.find(g => g.year === currentYear)
  const pastGoals   = goals.filter(g => g.year !== currentYear).sort((a, b) => b.year - a.year)

  return (
    <>
      <section className="dash-section">
        <h2 className="dash-heading">{currentYear} reading goal</h2>
        {currentGoal
          ? <GoalCard goal={currentGoal} booksRead={booksReadInYear(currentYear)} onEdit={editGoal} onDelete={deleteGoal} />
          : <NewGoalForm year={currentYear} onSave={addGoal} />
        }
      </section>

      {pastGoals.length > 0 && (
        <section className="dash-section">
          <h2 className="dash-heading">Past goals</h2>
          {pastGoals.map(g => (
            <GoalCard key={g.id} goal={g} booksRead={booksReadInYear(g.year)} onEdit={editGoal} onDelete={deleteGoal} />
          ))}
        </section>
      )}
    </>
  )
}
