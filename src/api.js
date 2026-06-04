export async function searchExternalBooks(query) {
  const [olRes, gbRes] = await Promise.allSettled([
    fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=5&fields=key,title,author_name,number_of_pages_median,subject,cover_i`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() }),
    fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=5`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() }),
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

export function parseCSV(text) {
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

export function goodreadsToBooks(text) {
  const rows = parseCSV(text)
  if (rows.length < 2) return []
  const headers = rows[0].map(h => h.trim())
  if (!['Title', 'Author', 'Exclusive Shelf'].every(h => headers.includes(h))) return []
  const statusMap = { 'read': 'read', 'currently-reading': 'reading', 'to-read': 'want' }
  const grDate = d => (d ? d.replace(/\//g, '-') : null)

  return rows.slice(1)
    .filter(r => r.some(Boolean))
    .map(row => {
      const g = {}
      headers.forEach((h, i) => { g[h] = (row[i] || '').trim() })

      const isbn13 = (g['ISBN13'] || '').replace(/[="]/g, '')
      const isbn   = (g['ISBN']   || '').replace(/[="]/g, '')
      const isbn_  = isbn13 || isbn
      const status = statusMap[g['Exclusive Shelf']] || 'want'

      const dateAdded    = grDate(g['Date Added'])
      const dateFinished = status === 'read' ? grDate(g['Date Read']) : null
      // Only use Date Added as start date if it's on or before Date Read
      // (books added retroactively have Date Added > Date Read)
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
        year:          parseInt(g['Original Publication Year'], 10) || parseInt(g['Year Published'], 10) || null,
      }
    })
    .filter(b => b.title)
}

export async function lookupPublicationYear(title, author) {
  try {
    const q = encodeURIComponent(`${title} ${author}`.trim())
    const r = await fetch(
      `https://openlibrary.org/search.json?q=${q}&limit=1&fields=first_publish_year`
    )
    if (!r.ok) return null
    const res = await r.json()
    return res.docs?.[0]?.first_publish_year || null
  } catch {
    return null
  }
}

export async function lookupCoverByTitle(title, author) {
  try {
    const q = encodeURIComponent(`${title} ${author}`.trim())
    const r = await fetch(
      `https://openlibrary.org/search.json?q=${q}&limit=1&fields=cover_i`
    )
    if (!r.ok) return ''
    const { docs } = await r.json()
    const id = docs?.[0]?.cover_i
    return id ? `https://covers.openlibrary.org/b/id/${id}-M.jpg` : ''
  } catch {
    return ''
  }
}
