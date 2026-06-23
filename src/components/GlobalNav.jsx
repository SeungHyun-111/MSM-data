import { useEffect, useState } from 'react'
import './GlobalNav.css'

const menuItems = [
  { id: 'main', label: '메인페이지' },
  { id: 'competitor', label: '경쟁사 편성' },
  { id: 'strategy', label: '월간 편성 전략' },
  { id: 'settings', label: '설정' },
  { id: 'print', label: '인쇄' },
]

export default function GlobalNav({
  activePage,
  onExportPdf,
  onMenuOpenChange,
  onNavigate,
  onRefreshCompetitorData,
  onRefreshStrategyData,
  onShowDbStatus,
}) {
  const [activeMenu, setActiveMenu] = useState(null)
  const isSettingsOpen = activeMenu === 'settings'
  const isPrintOpen = activeMenu === 'print'
  const isMenuOpen = isSettingsOpen || isPrintOpen

  useEffect(() => {
    onMenuOpenChange(isMenuOpen)
  }, [isMenuOpen, onMenuOpenChange])

  return (
    <header
      className={`global-nav ${isMenuOpen ? 'is-menu-open' : ''}`}
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
                if (!['settings', 'print'].includes(item.id)) onNavigate(item.id)
              }}
              onMouseEnter={() => setActiveMenu(['settings', 'print'].includes(item.id) ? item.id : null)}
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
                경쟁사 데이터 갱신
              </button>
              <button type="button" onClick={onRefreshStrategyData}>
                월간전략 데이터 갱신
              </button>
              <button type="button" onClick={onShowDbStatus}>
                DB 현황
              </button>
            </div>
          )}
          {isPrintOpen && (
            <div className="settings-menu">
              <button type="button" onClick={onExportPdf}>
                인쇄/PDF
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
