import type { Metadata, Viewport } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/sonner"

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
})

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    default: "Brainer",
    template: "%s · Brainer",
  },
  description:
    "A second brain for people whose attention runs fast: capture, plan, focus, and actually finish.",
  icons: { icon: "/favicon.ico" },
}

export const viewport: Viewport = {
  themeColor: "#0e0f13",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark h-full antialiased">
      <body className={`${inter.variable} ${jetbrainsMono.variable} min-h-full flex flex-col`}>
        {children}
        <Toaster theme="dark" />
      </body>
    </html>
  )
}
