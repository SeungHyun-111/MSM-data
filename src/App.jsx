import { useState } from 'react'
import DbStatusModal from './components/DbStatusModal'
import GlobalNav from './components/GlobalNav'
import RefreshCompetitorModal from './components/RefreshCompetitorModal'
import Dashboard from './pages/Dashboard'
import MainPage from './pages/MainPage'
import StrategyPage from './pages/StrategyPage'

const COMPETITOR_REFRESH_URL = 'https://script.google.com/macros/s/AKfycbx_g4uio1KGQOSB9S6pJ-rIwurCVWRKdnq22McjgAxBav0X9a795ovPYMLDil3amNqV/exec'
const FIREBASE_BASE_URL = 'https://schedule-7ec7a-default-rtdb.asia-southeast1.firebasedatabase.app'
const FIREBASE_MSM_PATH = 'competitorInfo/monthly'

function getCurrentMonth() {
  const now = new Date()
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
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

async function fetchDbStatus() {
  const url = `${FIREBASE_BASE_URL}/${FIREBASE_MSM_PATH}.json`
  const res = await fetch(url)

  if (!res.ok) {
    const message = await res.text()
    throw new Error(`Firebase read failed: ${res.status} ${message}`)
  }

  const payload = await res.json()
  if (!payload) return []

  return Object.entries(payload)
    .map(([month, item]) => ({
      month,
      updatedAt: item?.updatedAt,
      rowCount: Object.values(item?.data || {}).reduce(
        (sum, rows) => sum + (Array.isArray(rows) ? rows.length : 0),
        0,
      ),
    }))
    .sort((a, b) => b.month.localeCompare(a.month))
}

export default function App() {
  const [activePage, setActivePage] = useState('main')
  const [isNavExpanded, setIsNavExpanded] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonth)
  const [monthlyData, setMonthlyData] = useState(null)
  const [isRefreshModalOpen, setIsRefreshModalOpen] = useState(false)
  const [isDbStatusOpen, setIsDbStatusOpen] = useState(false)
  const [isDbStatusLoading, setIsDbStatusLoading] = useState(false)
  const [dbStatusError, setDbStatusError] = useState(null)
  const [dbStatusMonths, setDbStatusMonths] = useState([])
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshStatus, setRefreshStatus] = useState(null)

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

      setCurrentMonth(ym)
      setMonthlyData(result.payload.data)
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
      const months = await fetchDbStatus()
      setDbStatusMonths(months)
    } catch (error) {
      setDbStatusMonths([])
      setDbStatusError(error.message)
    } finally {
      setIsDbStatusLoading(false)
    }
  }

  return (
    <div className={`app-shell ${isNavExpanded ? 'is-nav-expanded' : ''}`}>
      <GlobalNav
        activePage={activePage}
        onMenuOpenChange={setIsNavExpanded}
        onNavigate={setActivePage}
        onRefreshCompetitorData={() => setIsRefreshModalOpen(true)}
        onShowDbStatus={handleShowDbStatus}
      />
      <div className="page-content">
        {activePage === 'main' && <MainPage />}
        {activePage === 'competitor' && <Dashboard month={currentMonth} data={monthlyData} />}
        {activePage === 'strategy' && <StrategyPage />}
      </div>
      {isRefreshModalOpen && (
        <RefreshCompetitorModal
          isRefreshing={isRefreshing}
          status={refreshStatus}
          onClose={handleCloseRefreshModal}
          onRefresh={handleRefreshCompetitorData}
        />
      )}
      {isDbStatusOpen && (
        <DbStatusModal
          error={dbStatusError}
          isLoading={isDbStatusLoading}
          months={dbStatusMonths}
          onClose={() => setIsDbStatusOpen(false)}
        />
      )}
    </div>
  )
}
