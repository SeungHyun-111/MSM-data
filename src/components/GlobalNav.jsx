import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import './GlobalNav.css'

const menuItems = [
  { id: 'main', label: '메인페이지' },
  { id: 'competitor', label: '경쟁사 편성' },
  { id: 'strategy', label: '월간 편성 전략' },
  { id: 'settings', label: '설정' },
  { id: 'print', label: '인쇄' },
]

const coachSteps = [
  { id: 'main', title: '메인 페이지', description: '월간 전략회의의 시작 화면으로 이동합니다.' },
  { id: 'competitor', title: '경쟁사 분석', description: '경쟁사 실적과 주요 지표를 확인합니다.' },
  { id: 'strategy', title: '월간 편성 전략', description: '팀별 월간 전략을 조회하고 작성합니다.' },
  { id: 'settings', title: '설정', description: '데이터 갱신과 DB 현황 메뉴를 엽니다.' },
  { id: 'print', title: '인쇄', description: '작성한 전략을 인쇄하거나 PDF로 저장합니다.' },
]

coachSteps[3].menu = 'settings'
coachSteps.splice(4, 0,
  { id: 'refresh-competitor', menu: 'settings', title: '경쟁사 데이터 갱신', description: '선택한 월의 경쟁사 분석 데이터를 새로 불러옵니다.' },
  { id: 'refresh-strategy', menu: 'settings', title: '월간 전략 데이터 갱신', description: '선택한 월의 편성 전략 데이터를 새로 불러옵니다.' },
  { id: 'db-status', menu: 'settings', title: 'DB 현황', description: '현재 데이터베이스의 연결 및 저장 현황을 확인합니다.' },
)
coachSteps[7].menu = 'print'
coachSteps.push({ id: 'export-pdf', menu: 'print', title: '인쇄/PDF', description: '작성한 월간 전략을 인쇄하거나 PDF로 저장합니다.' })

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
  const [coachStep, setCoachStep] = useState(-1)
  const [coachPosition, setCoachPosition] = useState(null)
  const navItemRefs = useRef({})
  const isSettingsOpen = activeMenu === 'settings'
  const isPrintOpen = activeMenu === 'print'
  const isMenuOpen = isSettingsOpen || isPrintOpen

  useEffect(() => {
    onMenuOpenChange(isMenuOpen)
  }, [isMenuOpen, onMenuOpenChange])

  useLayoutEffect(() => {
    if (coachStep < 0) return undefined

    const updatePosition = () => {
      const target = navItemRefs.current[coachSteps[coachStep].id]
      if (!target) return
      const rect = target.getBoundingClientRect()
      setCoachPosition({
        left: rect.left + rect.width / 2,
        top: rect.bottom + 14,
        targetLeft: rect.left - 5,
        targetTop: rect.top - 4,
        targetWidth: rect.width + 10,
        targetHeight: rect.height + 8,
      })
    }

    updatePosition()
    const transitionTimer = window.setTimeout(updatePosition, 220)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.clearTimeout(transitionTimer)
      window.removeEventListener('resize', updatePosition)
    }
  }, [activeMenu, coachStep])

  useEffect(() => {
    if (coachStep < 0) return
    const currentStep = coachSteps[coachStep]
    if (currentStep.menu === 'print' && activePage !== 'strategy') {
      onNavigate('strategy')
    }
    setActiveMenu(currentStep.menu || null)
  }, [activePage, coachStep, onNavigate])

  const closeCoach = () => {
    setActiveMenu(null)
    setCoachStep(-1)
    setCoachPosition(null)
  }

  const showNextCoach = () => {
    if (coachStep === coachSteps.length - 1) closeCoach()
    else setCoachStep((current) => current + 1)
  }

  return (
    <header
      className={`global-nav ${isMenuOpen ? 'is-menu-open' : ''}`}
      onMouseLeave={() => {
        if (coachStep < 0) setActiveMenu(null)
      }}
    >
      <nav className="nav-bar" aria-label="Primary navigation">
        <div className="nav-links">
          {menuItems.map((item) => (
            <button
              key={item.id}
              ref={(node) => { navItemRefs.current[item.id] = node }}
              type="button"
              className={`nav-link ${activePage === item.id ? 'is-active' : ''} ${coachStep >= 0 && coachSteps[coachStep].id === item.id ? 'is-coach-active' : ''}`}
              onClick={() => {
                if (!['settings', 'print'].includes(item.id)) onNavigate(item.id)
              }}
              onMouseEnter={() => setActiveMenu(['settings', 'print'].includes(item.id) ? item.id : null)}
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            className="nav-coach-trigger"
            aria-label="상단 메뉴 사용 안내 보기"
            title="사용 안내"
            onClick={() => {
              setActiveMenu(null)
              setCoachStep(0)
            }}
          >
            <span className="nav-coach-trigger-icon" aria-hidden="true">?</span>
            <span>도움말</span>
          </button>
        </div>
      </nav>

      {coachStep >= 0 && coachPosition && (
        <div className="nav-coach-layer" role="dialog" aria-modal="true" aria-label="상단 메뉴 사용 안내">
          <div
            className="nav-coach-highlight"
            style={{
              left: coachPosition.targetLeft,
              top: coachPosition.targetTop,
              width: coachPosition.targetWidth,
              height: coachPosition.targetHeight,
            }}
          />
          <section
            className="nav-coach-card"
            style={{ left: coachPosition.left, top: coachPosition.top }}
          >
            <div className="nav-coach-progress">
              <span>상단 메뉴 안내</span>
              <span>{coachStep + 1} / {coachSteps.length}</span>
            </div>
            <h2>{coachSteps[coachStep].title}</h2>
            <p>{coachSteps[coachStep].description}</p>
            <div className="nav-coach-actions">
              <button type="button" className="nav-coach-skip" onClick={closeCoach}>건너뛰기</button>
              <div>
                {coachStep > 0 && (
                  <button type="button" className="nav-coach-prev" onClick={() => setCoachStep((current) => current - 1)}>이전</button>
                )}
                <button type="button" className="nav-coach-next" onClick={showNextCoach}>
                  {coachStep === coachSteps.length - 1 ? '완료' : '다음'}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      <div className="mega-menu">
        <div className="mega-inner">
          {isSettingsOpen && (
            <div className="settings-menu">
              <button
                type="button"
                ref={(node) => { navItemRefs.current['refresh-competitor'] = node }}
                className={coachStep >= 0 && coachSteps[coachStep].id === 'refresh-competitor' ? 'is-coach-active' : ''}
                onClick={onRefreshCompetitorData}
              >
                경쟁사 데이터 갱신
              </button>
              <button
                type="button"
                ref={(node) => { navItemRefs.current['refresh-strategy'] = node }}
                className={coachStep >= 0 && coachSteps[coachStep].id === 'refresh-strategy' ? 'is-coach-active' : ''}
                onClick={onRefreshStrategyData}
              >
                월간전략 데이터 갱신
              </button>
              <button
                type="button"
                ref={(node) => { navItemRefs.current['db-status'] = node }}
                className={coachStep >= 0 && coachSteps[coachStep].id === 'db-status' ? 'is-coach-active' : ''}
                onClick={onShowDbStatus}
              >
                DB 현황
              </button>
            </div>
          )}
          {isPrintOpen && (
            <div className="settings-menu">
              <button
                type="button"
                ref={(node) => { navItemRefs.current['export-pdf'] = node }}
                className={coachStep >= 0 && coachSteps[coachStep].id === 'export-pdf' ? 'is-coach-active' : ''}
                onClick={onExportPdf}
              >
                인쇄/PDF
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
