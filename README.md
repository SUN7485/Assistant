# مساعد المدرس — Teacher Assistant

A tutoring-centre platform in Egyptian Arabic. Three kinds of account, each signing in with a phone number and password:

| Account | Sees and does |
|---|---|
| **Manager** (مدير المنصة) | Everything: teachers and their permissions, groups, students, attendance, grading, subscriptions, reports to parents, notices |
| **Teacher** (مدرس) | Only their own groups. Attendance, grading, adding students and seeing payments only if the manager ticked that permission |
| **Student** (طالب) | Photographs a homework solution, one photo per page (up to 10), and sends it; can add a forgotten page until the teacher has reviewed it. Sees their own attendance and the centre's notices. **Never** sees right/wrong counts or the teacher's notes |

How the centre is modelled:

- A **student can be in several groups** (one per subject or teacher) with one account. Each group has its monthly fee and is paid for separately; a student who pays something else (a discount, a sibling) gets a special fee for that group.
- A **teacher sees only their own side** of a shared student: the homework, solutions, grades and photos of their own groups.
- **Nothing recorded is lost by tidying up**: a student who leaves a group keeps their history there, and last year's group is archived, not deleted. Only things made by mistake (an empty group, an account with no payments) can be deleted.

These rules are enforced by the database (PostgreSQL row-level security), not just by hiding things on screen. `supabase/tests/rls.sql` proves them.

Built with Next.js (on Vercel) and Supabase (database, logins, photo storage). Students can add it to their phone's home screen and it opens like an app.

---

## Put it online (about 15 minutes)

### 1. Supabase: database, logins, photos
1. Create a free account at supabase.com and make a **new project**. Choose the region **Frankfurt (eu-central-1)**: it is the closest to Egypt, and the website is set to run there too (`vercel.json`). Save the database password somewhere safe.
2. Open **Authentication → Sign In / Providers** and turn **off** "Allow new users to sign up". Accounts are made only inside the app.
3. Open **Authentication → Rate Limits** and raise **sign-ups and sign-ins** from 30 to about 300 per 5 minutes. A whole class signing in from the centre's Wi-Fi shares one address, and 30 is not enough for that.
4. Recommended: under **Authentication → Sign In / Providers → Email**, turn on **Secure password change**, so a password can only be changed right after signing in.
5. Open **Project Settings → API Keys** (or the **Connect** button) and copy three things:
   - the **Project URL**
   - the **anon / publishable** key
   - the **service_role / secret** key. Keep this one private and never post it anywhere.

### 2. Vercel: the website
1. Create an account at vercel.com with GitHub, then **Add New → Project** and import this repository.
2. Under **Environment Variables**, add the three values (see `.env.example`):
   - `NEXT_PUBLIC_SUPABASE_URL` = the Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = the anon / publishable key
   - `SUPABASE_SERVICE_ROLE_KEY` = the service_role / secret key
3. Press **Deploy**. You get a link like `https://assistant-xyz.vercel.app`.

### 3. First run
1. Open `https://<your-link>/setup`. It checks the settings and tells you what is missing. The first time, it gives you a **copy button for the database file**: paste it into Supabase **SQL Editor**, press **Run**, wait for *Success*, and refresh. (The file is `supabase/install.sql` if you prefer to open it yourself.)
2. Make the manager account straight away. The page works once and then closes itself; until then, whoever opens it first becomes the manager.
3. **المدرسين**: add the teachers and tick their permissions.
4. **المجموعات**: add groups with their monthly fee, then their students — one at a time, or paste the whole class list at once (each student gets an eight-digit password, shown once). A student who takes a second subject is added to the second group by the manager with the **same phone number** and keeps one account.
5. Give each student the link plus their phone number and password. On the phone they open the link, sign in, and choose **Add to Home Screen**. They can change their password under **حسابي**.

### Updating later
When a new version changes the database, deploy the code first. Until the database is brought up to date, the app shows everyone "المنصة بتتحدّث", and shows the **manager** a copy button for exactly the file to run in Supabase SQL Editor. Run it, refresh, done. Nothing else needs to be remembered.

### Costs
Both services are free while testing. For real use, plan on Supabase **Pro (about $25/month)**, because free projects pause after a week with no activity. Vercel's free Hobby plan is for non-commercial use, so a paying client should use **Vercel Pro (about $20/month)**. Check current prices on both sites.

---

## Working on the code

Needs Node 20+ and Docker.

```bash
npm install
npm run db:start     # local Supabase in Docker, with every migration applied
npm run db:env       # writes .env.local for it
npm run dev          # http://localhost:3000, then open /setup
```

Checks (CI runs all of them on every push, `.github/workflows/ci.yml`):

```bash
npm run check        # types, lint, unit tests, and that supabase/install.sql is up to date
npm run db:reset && npm run test:rls                     # who can see and change what, on a fresh database
npm run db:reset && npm run build && (npm start &) && npm run test:walk
                     # one full day in a real browser: manager, two teachers, students
```

A database change:

1. Add a **new** file under `supabase/migrations/` (never edit one that has been released). If the app cannot work without it, raise the number in its `schema_version()` and in `lib/schema.ts`, and add the file's name there, so a deployed app can tell the manager to run it.
2. `npm run db:reset`, then `npm run db:types` (TypeScript types for the tables) and `npm run db:bundle` (`supabase/install.sql` for new projects).
3. Add a check to `supabase/tests/rls.sql` when it touches who can see what.

### Where things are
- `supabase/migrations/` — tables, access rules, photo bucket. `supabase/install.sql` is all of them joined, generated.
- `app/actions/` — every save, by area (`people`, `groups`, `daily`, `money`, `auth`). Each one checks who is calling before it writes; `shared.ts` has the helpers that use the service key.
- `app/(app)/*/page.tsx` — the screens. `app/(app)/layout.tsx` is the header and tabs, and the "database is behind" notice.
- `components/UploadForm.tsx` — the student's camera: shrinks each page's photo on the phone, then uploads them. `PageViewer.tsx` — the teacher turning the pages. `BulkAdd.tsx` — pasting a class list. `LoginForm.tsx` — signing in from the browser.
- `lib/` — the signed-in person (`me.ts`), database clients (`supabase.ts`) and generated types, reading lists past the 1000-row limit (`data.ts`), dates in Cairo time and figures (`util.ts`), phone numbers as people type them (`phone.ts`), reading a pasted class list (`roster.ts`).
- Totals (attendance, averages, who sent, last class) are counted by database views at the end of the last migration, not in the screens.
- `tests/` — unit tests for the pure helpers. `scripts/walk.mjs` — the browser walkthrough.
