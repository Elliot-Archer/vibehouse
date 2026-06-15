import type { Metadata, Viewport } from 'next'
import Link from 'next/link'
import './globals.css'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { LogoutButton } from './LogoutButton'

export const metadata: Metadata = {
  title: 'Tjokkellust',
  description: 'Schoonmaakrooster voor je studentenhuis',
  manifest: '/manifest.json',
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
  let user = null
  let profile = null

  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()

    if (authUser) {
      user = authUser
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('email', authUser.email)
        .single()
      profile = data
    }
  } catch (_) {
    // Not authenticated
  }

  const adminIds = (process.env.ADMIN_USER_IDS ?? '').split(',').filter(Boolean)
  const isAdmin = !!user && adminIds.includes(user.id)

  return (
    <html lang="nl">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="bg-slate-50 min-h-screen">
        <div className="max-w-md mx-auto bg-white min-h-screen flex flex-col">
          <main className="flex-1 pb-20">{children}</main>

          {user && (
            <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 pb-safe z-50">
              <div className="max-w-md mx-auto flex items-center justify-around h-16">
                <NavItem href="/schema" label="Schema" icon={<CalendarIcon />} />
                <NavItem
                  href="/ruilverzoeken"
                  label="Ruilen"
                  icon={<SwapIcon />}
                />
                <NavItem href="/wachtwoord" label="Profiel" icon={<ProfileIcon />} />
                {isAdmin && (
                  <NavItem href="/admin" label="Beheer" icon={<AdminIcon />} />
                )}
                <LogoutButton />
              </div>
            </nav>
          )}
        </div>

        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.__VAPID_PUBLIC_KEY__ = ${JSON.stringify(process.env.VAPID_PUBLIC_KEY || '')};
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js', { scope: '/' });
                });
              }
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

function AdminIcon() {
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
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  )
}
