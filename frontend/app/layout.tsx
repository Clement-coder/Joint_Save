import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { Web3Provider } from "@/components/web3-provider"
import { ThemeProvider } from "@/components/theme-provider"
import { Suspense } from "react"

export const metadata: Metadata = {
  title: "JointSave - Community Savings on Stellar",
  description:
    "Save together, grow together. Decentralized community savings built on the Stellar blockchain.",
  icons: {
    icon: "/joint-save.jpg",
    shortcut: "/joint-save.jpg",
    apple: "/joint-save.jpg",
  },
  openGraph: {
    title: "JointSave - Community Savings on Stellar",
    description: "Save together, grow together. Decentralized community savings built on the Stellar blockchain.",
    images: ["/joint-save.jpg"],
  },
  twitter: {
    card: "summary_large_image",
    title: "JointSave - Community Savings on Stellar",
    description: "Save together, grow together. Decentralized community savings built on the Stellar blockchain.",
    images: ["/joint-save.jpg"],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <Suspense fallback={null}>
            <Web3Provider>{children}</Web3Provider>
          </Suspense>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
