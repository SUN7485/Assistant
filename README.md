# مساعد المدرس — Teacher Assistant

A tutoring-centre platform in Egyptian Arabic. Three kinds of account, each signing in with a phone number and password:

| Account | Sees and does |
|---|---|
| **Manager** (مدير المنصة) | Everything: teachers and their permissions, groups, students, attendance, grading, subscriptions, reports to parents, notices |
| **Teacher** (مدرس) | Only their own groups. Attendance, grading, adding students and seeing payments only if the manager ticked that permission |
| **Student** (طالب) | Photographs a homework solution and sends it, and sees their own attendance. **Never** sees right/wrong counts or the teacher's notes |

The "student never sees grades" rule is enforced by the database (PostgreSQL row-level security), not just by hiding it on screen. `supabase/tests/rls.sql` proves it.

Built with Next.js (on Vercel) and Supabase (database, logins, photo storage). Students can add it to their phone's home screen and it opens like an app.

---

## Put it online (about 15 minutes)

### 1. Supabase: database, logins, photos
1. Create a free account at supabase.com and make a **new project**. Choose the region **Frankfurt (eu-central-1)**, the closest to Egypt. Save the database password somewhere safe.
2. Open **SQL Editor** and run every file in `supabase/migrations/`, one at a time, **oldest first** (the date is in the file name). For each one: paste the whole file, press **Run**, and wait for *Success* before the next. Today that is:
   1. `20261113000000_init.sql`
   2. `20261114000000_tighten.sql`
3. Open **Authentication → Sign In / Providers** and turn **off** "Allow new users to sign up". Accounts are made only by the manager inside the app.
4. Open **Project Settings → API Keys** (or the **Connect** button) and copy three things:
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
1. Open `https://<your-link>/setup` and make the manager account. This page works once and then closes itself.
2. **Teachers** tab: add the teachers and tick their permissions.
3. **Groups** tab: add groups, then students (each student's phone number and a password), then homework.
4. Give each student the link plus their phone number and password. On the phone they open the link, sign in, and choose **Add to Home Screen**.

### Costs
Both services are free while testing. For real use, plan on Supabase **Pro (about $25/month)**, because free projects pause after a week with no activity. Vercel's free Hobby plan is for non-commercial use, so a paying client should use **Vercel Pro (about $20/month)**. Check current prices on both sites.

---

## Working on the code

```bash
npm install
npm run db:start            # local Supabase in Docker; prints the local keys
cp .env.example .env.local  # paste the local URL, publishable key and secret key
npm run dev                 # http://localhost:3000, then open /setup
```

Checks:

```bash
npm run typecheck
npm run test:rls            # who-can-see-what rules, against the local database
npx supabase db reset && npm run build && npm start &
node scripts/walk.mjs       # one full day in a real browser: manager, teacher, student (needs Playwright)
```

A database change goes in a **new** file under `supabase/migrations/`, plus a check in `supabase/tests/rls.sql` when it touches who can see what. On the live project, paste the new file into the SQL Editor.

### Where things are
- `supabase/migrations/` — tables, access rules, photo bucket
- `app/actions.ts` — every save: each one checks who is calling before it writes
- `app/(app)/*/page.tsx` — the screens
- `components/UploadForm.tsx` — the student's camera: shrinks the photo on the phone, then uploads it
- `lib/` — sign-in helpers, dates (Cairo time), figures
