import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Spin of Destiny',
}

export default function SpinPage() {
  return (
    <div className="fixed inset-0 z-40 bg-white">
      <iframe
        src="https://spin-of-destiny.vercel.app"
        title="Spin of Destiny"
        className="w-full h-full border-0"
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
    </div>
  )
}
