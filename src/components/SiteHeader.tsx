
import Link from 'next/link'

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link href="/lviv-arena" className="site-logo">
        <span className="logo-mark">LA</span>
        <span>
          <strong>LVIV ARENA</strong>
          <small>COMPUTER CLUB</small>
        </span>
      </Link>

      <nav className="site-nav">
        <a href="#about">Про клуб</a>
        <a href="#tariffs">Тарифи</a>
        <a href="#contacts">Контакти</a>
      </nav>

      <a className="booking-button" href="#tariffs">
        Забронювати місце ↗
      </a>
    </header>
  )
}
