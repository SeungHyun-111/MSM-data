import { useEffect, useState } from 'react'
import './GlobalNav.css'

const menuItems = [
  { id: 'main', label: '메인페이지' },
  { id: 'competitor', label: '경쟁사 편성' },
  { id: 'strategy', label: '월간 편성 전략' },
  { id: 'settings', label: '설정' },
]

export default function GlobalNav({
  activePage,
  onMenuOpenChange,
  onNavigate,
  onRefreshCompetitorData,
  onShowDbStatus,
}) {
  const [activeMenu, setActiveMenu] = useState(null)
  const isSettingsOpen = activeMenu === 'settings'

  useEffect(() => {
    onMenuOpenChange(isSettingsOpen)
  }, [isSettingsOpen, onMenuOpenChange])

  return (
    <header
      className={`global-nav ${isSettingsOpen ? 'is-menu-open' : ''}`}
      onMouseLeave={() => setActiveMenu(null)}
    >
      <nav className="nav-bar" aria-label="Primary navigation">
        <div className="nav-links">
          {menuItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-link ${activePage === item.id ? 'is-active' : ''}`}
              onClick={() => {
                if (item.id !== 'settings') onNavigate(item.id)
              }}
              onMouseEnter={() => setActiveMenu(item.id === 'settings' ? item.id : null)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="mega-menu">
        <div className="mega-inner">
          {isSettingsOpen && (
            <div className="settings-menu">
              <button type="button" onClick={onRefreshCompetitorData}>
                경쟁사 자료 갱신
              </button>
              <button type="button" onClick={onShowDbStatus}>
                DB 현황
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
