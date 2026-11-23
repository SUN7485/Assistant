import { defineConfig, globalIgnores } from 'eslint/config'
import next from 'eslint-config-next/core-web-vitals'
import typescript from 'eslint-config-next/typescript'

export default defineConfig([
  ...next,
  ...typescript,
  globalIgnores(['.next/**', 'next-env.d.ts', 'lib/database.types.ts']),
  {
    rules: {
      // Photos come from Supabase storage behind short-lived signed links, already shrunk on the phone; next/image has nothing to add.
      '@next/next/no-img-element': 'off',
      // Fonts are linked once, in the root layout.
      '@next/next/no-page-custom-font': 'off',
    },
  },
])
