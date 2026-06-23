import { useEffect, useState } from 'react'
import DbStatusModal from './components/DbStatusModal'
import GlobalNav from './components/GlobalNav'
import PrintTeamModal from './components/PrintTeamModal'
import RefreshCompetitorModal from './components/RefreshCompetitorModal'
import Dashboard from './pages/Dashboard'
import MainPage from './pages/MainPage'
import StrategyPage from './pages/StrategyPage'

const COMPETITOR_REFRESH_URL = 'https://script.google.com/macros/s/AKfycbzE147wQl7Qiz59QEB-vxEppregg32FbZRCqSHqmaK8_8OiMpPnu-S_znUeyORt59gd/exec'
const STRATEGY_REFRESH_URL = 'https://script.google.com/macros/s/AKfycbwCDcSH4P2Ar2W45_VxuVVQyj0Sa1SzFuVOAMGGFkGp185peKQHmzRKTAbqG0EzYYzb6Q/exec'
const FIREBASE_BASE_URL = 'https://schedule-7ec7a-default-rtdb.asia-southeast1.firebasedatabase.app'
const FIREBASE_MSM_PATH = 'competitorInfo/monthly'
const FIREBASE_STRATEGY_PATH = 'monthlyStrategy'
const APP_STATE_CACHE_KEY = 'msm:app-state'

function getCurrentMonth() {
  const now = new Date()
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
}

function addMonths(month, offset) {
  const year = Number(month.slice(0, 4))
  const monthNumber = Number(month.slice(4, 6))
  const date = new Date(year, monthNumber - 1 + offset, 1)
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`
}

function readCachedAppState() {
  try {
    return JSON.parse(localStorage.getItem(APP_STATE_CACHE_KEY) || '{}')
  } catch {
    localStorage.removeItem(APP_STATE_CACHE_KEY)
    return {}
  }
}

function requestJsonp(baseUrl, params) {
  return new Promise((resolve, reject) => {
    const callbackName = `__msmRefresh_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const url = new URL(baseUrl)
    const script = document.createElement('script')
    const timeoutId = window.setTimeout(() => {
      cleanup()
      reject(new Error('GAS response timeout'))
    }, 120000)

    const cleanup = () => {
      window.clearTimeout(timeoutId)
      delete window[callbackName]
      script.remove()
    }

    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })
    url.searchParams.set('callback', callbackName)

    console.info('[MSM] Requesting GAS refresh', url.toString())

    window[callbackName] = (payload) => {
      console.info('[MSM] GAS refresh response', payload)
      cleanup()
      resolve(payload)
    }

    script.onerror = () => {
      console.error('[MSM] GAS JSONP script load failed', {
        url: url.toString(),
        hint: 'Apps Script deployment may still be returning JSON instead of JavaScript. Redeploy g_msm as a new web app version.',
      })
      cleanup()
      reject(new Error(`GAS request failed: ${url.toString()}`))
    }

    script.src = url.toString()
    document.body.appendChild(script)
  })
}

async function saveCompetitorPayloadToFirebase(ym, payload) {
  const url = `${FIREBASE_BASE_URL}/${FIREBASE_MSM_PATH}/${ym}.json`
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const message = await res.text()
    throw new Error(`Firebase save failed: ${res.status} ${message}`)
  }
}

async function saveStrategyPayloadToFirebase(ym, payload) {
  const url = `${FIREBASE_BASE_URL}/${FIREBASE_STRATEGY_PATH}/${ym}.json`
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const message = await res.text()
    throw new Error(`Firebase save failed: ${res.status} ${message}`)
  }
}

async function fetchDbStatus() {
  const [competitorRes, strategyRes] = await Promise.all([
    fetch(`${FIREBASE_BASE_URL}/${FIREBASE_MSM_PATH}.json`),
    fetch(`${FIREBASE_BASE_URL}/${FIREBASE_STRATEGY_PATH}.json`),
  ])

  if (!competitorRes.ok) {
    const message = await competitorRes.text()
    throw new Error(`Competitor DB read failed: ${competitorRes.status} ${message}`)
  }

  if (!strategyRes.ok) {
    const message = await strategyRes.text()
    throw new Error(`Strategy DB read failed: ${strategyRes.status} ${message}`)
  }

  const competitorPayload = await competitorRes.json()
  const strategyPayload = await strategyRes.json()

  const competitorMonths = Object.entries(competitorPayload || {})
    .map(([month, item]) => ({
      month,
      updatedAt: item?.updatedAt,
      rowCount: Object.values(item?.data || {}).reduce(
        (sum, rows) => sum + (Array.isArray(rows) ? rows.length : 0),
        0,
      ),
      meta: '방송행',
    }))
    .sort((a, b) => b.month.localeCompare(a.month))

  const strategyMonths = Object.entries(strategyPayload || {})
    .map(([month, item]) => {
      const teams = Object.values(item?.teams || {})
      const requestCount = teams.reduce((sum, team) => sum + (Array.isArray(team?.plans) ? team.plans.length : 0), 0)

      return {
        month,
        updatedAt: item?.updatedAt,
        rowCount: requestCount,
        meta: `${teams.length}개 조직`,
      }
    })
    .sort((a, b) => b.month.localeCompare(a.month))

  return [
    { id: 'competitor', title: '경쟁사 편성', rows: competitorMonths },
    { id: 'strategy', title: '월간전략', rows: strategyMonths },
  ]
}

export default function App() {
  const [cachedAppState] = useState(readCachedAppState)
  const defaultMonth = getCurrentMonth()
  const [activePage, setActivePage] = useState(cachedAppState.activePage || 'main')
  const [isNavExpanded, setIsNavExpanded] = useState(false)
  const [competitorMonth, setCompetitorMonth] = useState(
    cachedAppState.competitorMonth || cachedAppState.currentMonth || addMonths(defaultMonth, -1),
  )
  const [strategyMonth, setStrategyMonth] = useState(cachedAppState.strategyMonth || addMonths(defaultMonth, 1))
  const [scrollPositions, setScrollPositions] = useState(cachedAppState.scrollPositions || {})
  const [monthlyData, setMonthlyData] = useState(null)
  const [monthlyDataMonth, setMonthlyDataMonth] = useState(null)
  const [isRefreshModalOpen, setIsRefreshModalOpen] = useState(false)
  const [refreshMode, setRefreshMode] = useState('competitor')
  const [isDbStatusOpen, setIsDbStatusOpen] = useState(false)
  const [isPrintTeamModalOpen, setIsPrintTeamModalOpen] = useState(false)
  const [isDbStatusLoading, setIsDbStatusLoading] = useState(false)
  const [dbStatusError, setDbStatusError] = useState(null)
  const [dbStatusSections, setDbStatusSections] = useState([])
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshStatus, setRefreshStatus] = useState(null)
  const [strategyRefreshVersion, setStrategyRefreshVersion] = useState(0)

  useEffect(() => {
    localStorage.setItem(
      APP_STATE_CACHE_KEY,
      JSON.stringify({ activePage, competitorMonth, strategyMonth, scrollPositions }),
    )
  }, [activePage, competitorMonth, strategyMonth, scrollPositions])

  useEffect(() => {
    const targetScroll = scrollPositions[activePage] || 0
    window.requestAnimationFrame(() => window.scrollTo({ top: targetScroll, left: 0 }))
  }, [activePage, scrollPositions])

  const handleNavigate = (nextPage) => {
    setScrollPositions((current) => ({ ...current, [activePage]: window.scrollY }))
    setActivePage(nextPage)
  }

  const handleRefreshCompetitorData = async (ym) => {
    setIsRefreshing(true)
    setRefreshStatus({
      type: 'loading',
      month: ym,
      message: `${ym} 경쟁사 자료를 갱신하고 있습니다.`,
    })

    try {
      const result = await requestJsonp(COMPETITOR_REFRESH_URL, { month: ym })
      if (!result?.ok) throw new Error(result?.error || 'Unknown refresh error')
      if (!result.payload) throw new Error('GAS response has no payload')

      await saveCompetitorPayloadToFirebase(ym, result.payload)

      setCompetitorMonth(ym)
      setMonthlyData(result.payload.data)
      setMonthlyDataMonth(ym)
      setRefreshStatus({
        type: 'success',
        month: ym,
        message: `${ym} 경쟁사 자료 갱신이 완료되었습니다.`,
        detail: `Firebase: ${result.firebasePath}`,
        counts: result.counts,
      })
    } catch (error) {
      setRefreshStatus({
        type: 'error',
        month: ym,
        message: `${ym} 경쟁사 자료 갱신에 실패했습니다.`,
        detail: error.message,
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleRefreshStrategyData = async (ym) => {
    setIsRefreshing(true)
    setRefreshStatus({
      type: 'loading',
      month: ym,
      message: `${ym} 월간전략 데이터를 갱신하고 있습니다.`,
    })

    try {
      const result = await requestJsonp(STRATEGY_REFRESH_URL, { month: ym })
      if (!result?.ok) throw new Error(result?.error || 'Unknown refresh error')
      if (!result.payload) throw new Error('GAS response has no payload')

      await saveStrategyPayloadToFirebase(ym, result.payload)

      setStrategyMonth(ym)
      setStrategyRefreshVersion((version) => version + 1)
      setRefreshStatus({
        type: 'success',
        month: ym,
        message: `${ym} 월간전략 데이터 갱신이 완료되었습니다.`,
        detail: `Firebase: ${result.firebasePath || `${FIREBASE_STRATEGY_PATH}/${ym}`}`,
      })
    } catch (error) {
      setRefreshStatus({
        type: 'error',
        month: ym,
        message: `${ym} 월간전략 데이터 갱신에 실패했습니다.`,
        detail: error.message,
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleCloseRefreshModal = () => {
    if (isRefreshing) return
    setIsRefreshModalOpen(false)
    setRefreshStatus(null)
  }

  const handleShowDbStatus = async () => {
    setIsDbStatusOpen(true)
    setIsDbStatusLoading(true)
    setDbStatusError(null)

    try {
      const sections = await fetchDbStatus()
      setDbStatusSections(sections)
    } catch (error) {
      setDbStatusSections([])
      setDbStatusError(error.message)
    } finally {
      setIsDbStatusLoading(false)
    }
  }

  const handleOpenPrintTeamModal = () => {
    if (activePage !== 'strategy') {
      window.alert('월간 편성 전략 페이지에서 PDF 내보내기를 실행해주세요.')
      return
    }

    setIsPrintTeamModalOpen(true)
  }

  const handleExportStrategyPdf = (teamKeys) => {
    const popup = window.open('', '_blank', 'width=1600,height=1000')
    if (!popup) {
      window.alert('팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요.')
      return
    }

    setIsPrintTeamModalOpen(false)
    window.dispatchEvent(new CustomEvent('msm:export-strategy-pdf', { detail: { popup, teamKeys } }))
  }

  return (
    <div className={`app-shell ${isNavExpanded ? 'is-nav-expanded' : ''}`}>
      <GlobalNav
        activePage={activePage}
        onMenuOpenChange={setIsNavExpanded}
        onNavigate={handleNavigate}
        onRefreshCompetitorData={() => {
          setRefreshMode('competitor')
          setIsRefreshModalOpen(true)
        }}
        onRefreshStrategyData={() => {
          setRefreshMode('strategy')
          setIsRefreshModalOpen(true)
        }}
        onExportPdf={handleOpenPrintTeamModal}
        onShowDbStatus={handleShowDbStatus}
      />
      <div className="page-content">
        {activePage === 'main' && <MainPage />}
        {activePage === 'competitor' && (
          <Dashboard
            month={competitorMonth}
            data={monthlyDataMonth === competitorMonth ? monthlyData : null}
            onChangeMonth={setCompetitorMonth}
          />
        )}
        {activePage === 'strategy' && (
          <StrategyPage
            month={strategyMonth}
            refreshVersion={strategyRefreshVersion}
            onChangeMonth={setStrategyMonth}
          />
        )}
      </div>
      {isRefreshModalOpen && (
        <RefreshCompetitorModal
          defaultMonth={refreshMode === 'strategy' ? strategyMonth : competitorMonth}
          isRefreshing={isRefreshing}
          status={refreshStatus}
          title={refreshMode === 'strategy' ? '월간전략 데이터 갱신' : '경쟁사 데이터 갱신'}
          onClose={handleCloseRefreshModal}
          onRefresh={refreshMode === 'strategy' ? handleRefreshStrategyData : handleRefreshCompetitorData}
        />
      )}
      {isPrintTeamModalOpen && (
        <PrintTeamModal
          onClose={() => setIsPrintTeamModalOpen(false)}
          onExport={handleExportStrategyPdf}
        />
      )}
      {isDbStatusOpen && (
        <DbStatusModal
          error={dbStatusError}
          isLoading={isDbStatusLoading}
          sections={dbStatusSections}
          onClose={() => setIsDbStatusOpen(false)}
        />
      )}
    </div>
  )
}
