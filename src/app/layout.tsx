import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Compliance Gap Analyser — KJR Labs",
  description: "AI-powered pharmaceutical regulatory compliance gap analysis",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <script dangerouslySetInnerHTML={{
          __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})()`,
        }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
