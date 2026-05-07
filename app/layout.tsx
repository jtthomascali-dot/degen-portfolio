import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Degen Portfolio Analyzer',
  description: 'Find out if you\'re a Warren Buffett or a WSB Ape. Enter your holdings, get brutally roasted by AI.',
  openGraph: {
    title: 'Degen Portfolio Analyzer',
    description: 'Enter your portfolio. Get roasted.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0a0a0a] text-white">
        <nav className="border-b border-[#222] px-6 py-4 flex items-center justify-between">
          <a href="/" className="font-mono text-lg font-bold tracking-tight">
            🦍 <span className="text-white">degen</span><span className="text-orange-400">.fyi</span>
          </a>
          <div className="flex gap-6 text-sm text-zinc-400">
            <a href="/leaderboard" className="hover:text-white transition-colors">Leaderboard</a>
            <a href="/history"     className="hover:text-white transition-colors">My History</a>
          </div>
        </nav>
        {children}
      </body>
    </html>
  )
}
