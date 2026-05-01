import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "System SOP Compliance Gap Analyser — KJR Labs",
  description: "AI-powered pharmaceutical regulatory compliance gap analysis for system-level QA/GMP SOPs",
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.png" type="image/png" />
        <script dangerouslySetInnerHTML={{
          __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})()`,
        }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
