import React from "react"
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Header } from '@/components/header'
import { ThemeProvider } from '@/components/theme-provider'
import { AuthProvider } from '@/lib/auth/auth-context'
import './globals.css'

const geist = Geist({ 
  subsets: ['latin'],
  variable: '--font-sans',
})

const geistMono = Geist_Mono({ 
  subsets: ['latin'],
  variable: '--font-mono',
})

export const metadata: Metadata = {
  title: 'YouTube AI Builder',
  description: 'Generate scripts, scenes, SEO metadata, and thumbnails for your YouTube videos using AI',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#ffffff',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`bg-background ${geist.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <Header />
          {children}
          <Analytics />
        </ThemeProvider>
    <html lang="en" className="bg-background">
      <body className={`font-sans antialiased`}>
        <AuthProvider>
          <Header />
          {children}
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}
