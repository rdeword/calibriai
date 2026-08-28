import type { Metadata } from "next";
import { IBM_Plex_Mono, Onest } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const onest = Onest({
  subsets: ["latin", "cyrillic"],
  variable: "--font-onest",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "600", "700"],
  variable: "--font-plex",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CalibriAI",
  description: "Неофициальный AI-рекрутер для разбора вакансий",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className={`${onest.variable} ${plexMono.variable}`}>
      <body>
        <div className="app-frame">
          <header className="topbar">
            <div className="shell" style={{ paddingTop: 14, paddingBottom: 14 }}>
              <nav className="nav">
                <Link href="/" className="brand">
                  <span className="brand-mark">Calibri<span>AI</span></span>
                  <span className="brand-stamp">CONTRABAND</span>
                </Link>
                <div className="nav-links">
                  <Link href="/fetch">Загрузка</Link>
                  <Link href="/import">Добавить</Link>
                  <Link href="/settings">Настройки</Link>
                  <Link href="/resumes">Резюме</Link>
                  <Link href="/stats">Статистика</Link>
                  <Link href="/history">История</Link>
                  <Link href="/usage">Usage</Link>
                </div>
              </nav>
            </div>
          </header>
          <main className="shell">{children}</main>
        </div>
      </body>
    </html>
  );
}
