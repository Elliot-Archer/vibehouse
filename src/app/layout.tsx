import type { Metadata, Viewport } from 'next'
import Link from 'next/link'
import './globals.css'
import { getSessionUser } from '@/lib/session'

export const metadata: Metadata = {
  title: 'Tjokkellust',
  description: 'Schoonmaakrooster voor je studentenhuis',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Tjokkellust',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#1e3a8a',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Read session from the cookie locally — no auth-server round-trip.
  const user = await getSessionUser()

  return (
    <html lang="nl">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className="bg-slate-50 min-h-screen">
        <div className="max-w-md mx-auto bg-white min-h-screen flex flex-col">
          <main className="flex-1 pb-20">{children}</main>

          {user && (
            <>
              <Link
                href="/meldingen"
                className="fixed top-4 right-4 z-[60] w-9 h-9 bg-primary-400 rounded-full flex items-center justify-center shadow-lg hover:bg-primary-300 transition-colors"
                aria-label="Meldingen"
              >
                <BellIcon />
              </Link>
              <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 pb-safe z-50">
                <div className="max-w-md mx-auto flex items-center justify-around h-16">
                  <NavItem href="/schema" label="Schema" icon={<CalendarIcon />} />
                  <NavItem
                    href="/ruilverzoeken"
                    label="Ruilen"
                    icon={<SwapIcon />}
                  />
                  <PremiumSpinButton />
                  <NavItem href="/strepen" label="Strepen" icon={<StrepenIcon />} />
                  <NavItem href="/wachtwoord" label="Profiel" icon={<ProfileIcon />} />
                </div>
              </nav>
            </>
          )}
        </div>

        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.__VAPID_PUBLIC_KEY__ = ${JSON.stringify(process.env.VAPID_PUBLIC_KEY || '')};
              window.addEventListener('load', async function() {
                if (!('serviceWorker' in navigator)) return;

                const isProd = ${JSON.stringify(process.env.NODE_ENV === 'production')};

                if (isProd) {
                  navigator.serviceWorker.register('/sw.js', { scope: '/' });
                  return;
                }

                // In development: avoid stale cached Next.js chunks causing runtime crashes.
                try {
                  const registrations = await navigator.serviceWorker.getRegistrations();
                  await Promise.all(registrations.map((registration) => registration.unregister()));

                  if ('caches' in window) {
                    const keys = await caches.keys();
                    await Promise.all(keys.map((key) => caches.delete(key)));
                  }
                } catch (_) {}
              });
            `,
          }}
        />
      </body>
    </html>
  )
}

function NavItem({
  href,
  label,
  icon,
}: {
  href: string
  label: string
  icon: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-1 px-4 py-2 text-slate-500 hover:text-primary-500 transition-colors group"
    >
      <span className="group-[.active]:text-primary-500">{icon}</span>
      <span className="text-xs">{label}</span>
    </Link>
  )
}

function CalendarIcon() {
  return (
    <svg
      className="w-6 h-6"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  )
}

function SwapIcon() {
  return (
    <svg
      className="w-6 h-6"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
      />
    </svg>
  )
}

function ProfileIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  )
}

function StrepenIcon() {
  return (
    <svg
      className="w-6 h-6"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 6v6m0 0v6m0-6h6m-6 0H6"
      />
    </svg>
  )
}

function BellIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  )
}

function PremiumSpinButton() {
  return (
    <Link
      href="/spin"
      className="-mt-8 flex flex-col items-center group"
      aria-label="Spin of Destiny"
    >
      <span className="relative overflow-hidden w-14 h-14 rounded-full bg-gradient-to-br from-amber-200 via-yellow-400 to-amber-500 border-2 border-yellow-100 shadow-[0_8px_24px_rgba(245,158,11,0.45)] text-amber-950 flex items-center justify-center hover:scale-105 active:scale-100 transition-transform animate-pulse">
        <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/35 to-transparent group-hover:translate-x-full transition-transform duration-700" />
        <SparkleIcon />
      </span>
      <span className="text-[10px] font-semibold text-amber-700 mt-1 tracking-wide">
        Spin of Destiny
      </span>
    </Link>
  )
}

function SparkleIcon() {
  return (
    <svg
      className="w-6 h-6"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 3l1.95 4.05L18 9l-4.05 1.95L12 15l-1.95-4.05L6 9l4.05-1.95L12 3zM5 17l.975 2.025L8 20l-2.025.975L5 23l-.975-2.025L2 20l2.025-.975L5 17zm14-2l1.3 2.7L23 19l-2.7 1.3L19 23l-1.3-2.7L15 19l2.7-1.3L19 15z"
      />
    </svg>
  )
}
