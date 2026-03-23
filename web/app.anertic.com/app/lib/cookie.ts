import Cookies from 'js-cookie'

export function getCookie(name: string): string | undefined {
  return Cookies.get(name)
}

export function setCookie(name: string, value: string, days = 365) {
  Cookies.set(name, value, { path: '/', expires: days })
}

export function removeCookie(name: string) {
  Cookies.remove(name, { path: '/' })
}
