// Writes .env.local for the local Supabase started by "npm run db:start", so nothing has to be copied by hand.
import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const status = execSync('npx supabase status -o env', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
const get = (name) => status.match(new RegExp(`^${name}="?([^"\\n]+)"?$`, 'm'))?.[1]
const url = get('API_URL'), anon = get('ANON_KEY'), service = get('SERVICE_ROLE_KEY')
if (!url || !anon || !service) {
  console.error('Local Supabase is not running. Start it with: npm run db:start')
  process.exit(1)
}
writeFileSync('.env.local', `NEXT_PUBLIC_SUPABASE_URL=${url}\nNEXT_PUBLIC_SUPABASE_ANON_KEY=${anon}\nSUPABASE_SERVICE_ROLE_KEY=${service}\n`)
console.log('wrote .env.local for ' + url)
