'use client'

import { logoutAction } from './login/actions'

export function LogoutButton({
  variant = 'nav',
}: {
  variant?: 'nav' | 'profile'
}) {
  const className =
    variant === 'profile'
      ? 'w-full inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100 transition-colors'
      : 'flex flex-col items-center gap-1 px-4 py-2 text-slate-500 hover:text-red-500 transition-colors group'

  return (
    <button
      onClick={() => logoutAction()}
      className={className}
    >
      <LogoutIcon />
      <span className={variant === 'profile' ? '' : 'text-xs'}>Uitloggen</span>
    </button>
  )
}

function LogoutIcon() {
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
        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
      />
    </svg>
  )
}
