# Reading Tracker

A personal reading tracker built with React and Supabase.

## Setup

### 1. Supabase — create the table

In your Supabase project, open the **SQL Editor** and run:

```sql
create table books (
  id             bigint generated always as identity primary key,
  title          text not null,
  author         text,
  genre          text,
  status         text check (status in ('read', 'reading', 'want')) default 'want',
  rating         int  check (rating between 0 and 5) default 0,
  notes          text,
  pages          int,
  pages_read     int  default 0,
  date_started   date,
  date_finished  date,
  created_at     timestamptz default now()
);

-- Allow public read/write (personal app, no auth)
alter table books enable row level security;
create policy "Allow all" on books for all using (true) with check (true);
```

### 2. Environment variables

Copy `.env.example` to `.env` and fill in your credentials:

```
cp .env.example .env
```

Find your credentials in Supabase → **Settings → API**:
- `REACT_APP_SUPABASE_URL` — your Project URL
- `REACT_APP_SUPABASE_ANON_KEY` — your anon/public key

**Never commit `.env` to git.** It's already in `.gitignore` by default with create-react-app.

### 3. Install and run locally

```bash
npm install
npm start
```

### 4. Deploy to GitHub Pages

1. In `package.json`, update the `homepage` field:
   ```
   "homepage": "https://YOUR_GITHUB_USERNAME.github.io/book-shelf"
   ```

2. Push your code to a GitHub repo named `book-shelf`.

3. In your GitHub repo settings, go to **Settings → Secrets and variables → Actions**
   and add two repository secrets:
   - `REACT_APP_SUPABASE_URL`
   - `REACT_APP_SUPABASE_ANON_KEY`

4. Deploy:
   ```bash
   npm run deploy
   ```

   This builds the app and pushes to the `gh-pages` branch automatically.

5. In GitHub → **Settings → Pages**, set source to the `gh-pages` branch.

Your app will be live at `https://YOUR_GITHUB_USERNAME.github.io/book-shelf`.

## Features

- Add, edit, delete books
- Import book metadata from Open Library and Google Books
- Track reading status: want to read / currently reading / finished
- Star ratings (click any star on a card to rate instantly)
- Reading progress bar (pages read / total pages)
- Date started and date finished fields
- Summary stats: total, finished, reading now, average rating
- Filter by status, search by title or author
- Dark mode (follows system preference)
- Data persisted in Supabase Postgres
