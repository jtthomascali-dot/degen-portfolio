import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

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
      <body className={inter.className}>{children}</body>
    </html>
  )
}
