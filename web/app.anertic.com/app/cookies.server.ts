import { createCookie } from 'react-router'

export const currentSiteCookie = createCookie('anertic_current_site', {
  maxAge: 60 * 60 * 24 * 365, // 1 year
  path: '/',
  sameSite: 'lax',
  httpOnly: false,
  secure: process.env.NODE_ENV === 'production',
})
