// Safe to use in the browser too (lib/util.ts is server-side).

export const PHONE = /^01[0-9]{9}$/
/** Supabase signs people in by email; each phone number gets a fixed address that is never mailed. */
export const loginEmail = (phone: string) => `${phone}@phone.assistant.local`
/** Arabic keyboards type ٠١٢٣; the database and the login want 0123. Spaces and dashes go too. */
export const latin = (s: string) =>
  s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0))
export const cleanPhone = (s: string) => latin(s).replace(/[\s\-()]/g, '').replace(/^\+?20?(?=1[0-9]{9}$)/, '0')
