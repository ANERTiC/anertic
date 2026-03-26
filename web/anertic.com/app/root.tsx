import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";

export const meta: Route.MetaFunction = () => [
  { title: "ANERTiC — AI Personal Energy Platform" },
  {
    name: "description",
    content:
      "An autonomous AI agent that monitors, optimizes, and manages your energy ecosystem. EV charging, smart monitoring, and AI-powered insights.",
  },
  { property: "og:title", content: "ANERTiC — AI Personal Energy Platform" },
  {
    property: "og:description",
    content:
      "An autonomous AI agent that monitors, optimizes, and manages your energy ecosystem.",
  },
  { property: "og:type", content: "website" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,300&display=swap"
          rel="stylesheet"
        />
        <Meta />
        <Links />
      </head>
      <body className="bg-bg font-sans text-text antialiased">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Something went wrong";
  let message = "An unexpected error occurred.";

  if (isRouteErrorResponse(error)) {
    title = error.status === 404 ? "Page not found" : `Error ${error.status}`;
    message =
      error.status === 404
        ? "The page you are looking for does not exist."
        : error.statusText;
  } else if (error instanceof Error) {
    message = error.message;
  }

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="mb-2 text-2xl font-bold">{title}</h1>
        <p className="text-text-2">{message}</p>
        <a
          href="/"
          className="mt-6 inline-block rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-white"
        >
          Back to home
        </a>
      </div>
    </main>
  );
}
