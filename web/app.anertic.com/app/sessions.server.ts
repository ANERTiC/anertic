import { createCookieSessionStorage } from "react-router"

interface SessionData {
  accessToken: string
  refreshToken: string
}

const { getSession, commitSession, destroySession } =
  createCookieSessionStorage<SessionData>({
    cookie: {
      name: "__session",
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
      sameSite: "lax",
      secrets: [process.env.SESSION_SECRET || "dev-secret"],
      secure: process.env.NODE_ENV === "production",
    },
  })

export { getSession, commitSession, destroySession }

export async function getSessionFromRequest(request: Request) {
  return getSession(request.headers.get("Cookie"))
}
