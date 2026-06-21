import type { Metadata } from 'next'
import { JetBrains_Mono, Newsreader } from 'next/font/google'
import './globals.css'

const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })
const serif = Newsreader({ subsets: ['latin'], style: ['normal', 'italic'], variable: '--font-serif' })

export const metadata: Metadata = {
  title: 'DEGEN Portfolio Analyzer',
  description: 'Find out how reckless your portfolio really is. AI-powered roasts.',
  openGraph: {
    title: 'DEGEN Portfolio Analyzer',
    description: 'Find out how reckless your portfolio really is.',
    siteName: 'DEGEN',
  },
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${mono.variable} ${serif.variable} font-mono`}>{children}</body>
    </html>
  )
}
