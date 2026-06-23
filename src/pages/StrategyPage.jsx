import { useEffect, useMemo, useState } from 'react'
import './StrategyPage.css'
import { openSectionWindow } from '../utils/openSectionWindow'

const FIREBASE_BASE_URL = 'https://schedule-7ec7a-default-rtdb.asia-southeast1.firebasedatabase.app'
const STRATEGY_PATH = 'monthlyStrategy'
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1]
const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1)
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const STRATEGY_TEAM_CACHE_KEY = 'msm:strategy-team'
const DETAIL_COLUMNS = [
  { key: 'requestDate', label: '요청일', width: 116 },
  { key: 'requestTime', label: '시간', width: 92 },
  { key: 'mdCategory', label: 'MD분류', width: 130 },
  { key: 'programCodeName', label: '편성코드명', width: 300 },
  { key: 'dealType', label: '거래형태', width: 120 },
  { key: 'weightedMin', label: '가중분', width: 98 },
  { key: 'expectedRevenue', label: '예상취급', width: 126 },
  { key: 'expectedProfit', label: '예상이익', width: 126 },
  { key: 'remark', label: '비고', width: 220 },
]
const TEAMS = [
  { key: 'beauty', label: '뷰티' },
  { key: 'food', label: '식품' },
  { key: 'living', label: '리빙' },
  { key: 'healthFood', label: '헬스푸드' },
  { key: 'fashionTrend', label: '패션트렌드' },
  { key: 'cultureService', label: '문화/서비스' },
  { key: 'appliance', label: '가전' },
]

function readCachedTeam() {
  return localStorage.getItem(STRATEGY_TEAM_CACHE_KEY) || TEAMS[0].key
}

function addMonths(month, offset) {
  const year = Number(month.slice(0, 4))
  const monthNumber = Number(month.slice(4, 6))
  const date = new Date(year, monthNumber - 1 + offset, 1)
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`
}

function formatMonthLabel(month) {
  return `${month.slice(0, 4)}년 ${Number(month.slice(4, 6))}월`
}

function formatDateLabel(dateText) {
  if (!dateText) return ''
  const [, month, day] = dateText.match(/^\d{4}-(\d{2})-(\d{2})$/) || []
  return month && day ? `${Number(month)}/${Number(day)}` : dateText
}

function formatWon(value) {
  const num = Number(value || 0)
  if (!num) return ''
  if (Math.abs(num) >= 100000000) return `${(num / 100000000).toFixed(1)}억`
  if (Math.abs(num) >= 10000) return `${Math.round(num / 10000).toLocaleString()}만`
  return num.toLocaleString()
}

function buildCalendarDays(month) {
  const year = Number(month.slice(0, 4))
  const monthIndex = Number(month.slice(4, 6)) - 1
  const firstDate = new Date(year, monthIndex, 1)
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const blanks = Array.from({ length: firstDate.getDay() }, (_, index) => ({
    key: `blank-${index}`,
    day: '',
    date: '',
    isBlank: true,
  }))
  const days = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1
    const dayOfWeek = new Date(year, monthIndex, day).getDay()
    const date = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

    return {
      key: date,
      date,
      day,
      dayOfWeek,
      isBlank: false,
      isSaturday: dayOfWeek === 6,
      isHoliday: dayOfWeek === 0,
    }
  })

  return [...blanks, ...days]
}

function buildDailySummary(plans) {
  return plans.reduce((map, plan) => {
    if (!plan.requestDate) return map

    const item = map[plan.requestDate] || {
      count: 0,
      weightedMin: 0,
      expectedRevenue: 0,
      expectedProfit: 0,
      plans: [],
    }

    item.count += 1
    item.weightedMin += Number(plan.weightedMin || 0)
    item.expectedRevenue += Number(plan.expectedRevenue || 0)
    item.expectedProfit += Number(plan.expectedProfit || 0)
    item.plans.push(plan)
    map[plan.requestDate] = item

    return map
  }, {})
}

function sortPlans(plans) {
  return [...plans].sort((a, b) => {
    const dateCompare = String(a.requestDate || '').localeCompare(String(b.requestDate || ''))
    if (dateCompare !== 0) return dateCompare
    return String(a.requestTime || '').localeCompare(String(b.requestTime || ''))
  })
}

function getDetailSortValue(plan, columnKey) {
  if (columnKey === 'requestDate') return String(plan.requestDate || '')
  if (columnKey === 'requestTime') return String(plan.requestTime || '')
  if (['weightedMin', 'expectedRevenue', 'expectedProfit'].includes(columnKey)) {
    return Number(plan[columnKey] || 0)
  }
  return String(plan[columnKey] || '').toLowerCase()
}

function RichTextBlock({ richText, fallback }) {
  const runs = Array.isArray(richText?.runs) ? richText.runs : []

  if (runs.length === 0) return fallback || ''

  return runs.flatMap((run, index) => {
    const textDecorations = [
      run.underline ? 'underline' : '',
      run.strikethrough ? 'line-through' : '',
    ].filter(Boolean)
    const isItalic = Boolean(run.italic)
    const style = {
      color: run.foregroundColor || undefined,
      fontSize: run.fontSize ? `${run.fontSize}px` : undefined,
      fontFamily: run.fontFamily || undefined,
      fontWeight: run.bold ? 800 : undefined,
      fontStyle: isItalic ? 'oblique 12deg' : undefined,
      textDecoration: textDecorations.length > 0 ? textDecorations.join(' ') : undefined,
      textDecorationThickness: run.strikethrough ? '1.5px' : undefined,
    }

    return String(run.text || '').split('\n').flatMap((line, lineIndex, lines) => {
      const nodes = [
        <span className="rich-text-run" key={`${index}-${lineIndex}-text`} style={style}>
          {line}
        </span>,
      ]

      if (lineIndex < lines.length - 1) {
        nodes.push(<br key={`${index}-${lineIndex}-br`} />)
      }

      return nodes
    })
  })
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function richTextToHtml(richText, fallback) {
  const runs = Array.isArray(richText?.runs) ? richText.runs : []
  if (runs.length === 0) return escapeHtml(fallback || '').replace(/\n/g, '<br />')

  return runs.map((run) => {
    const decorations = [
      run.underline ? 'underline' : '',
      run.strikethrough ? 'line-through' : '',
    ].filter(Boolean)
    const styles = [
      run.foregroundColor ? `color:${run.foregroundColor}` : '',
      run.fontSize ? `font-size:${run.fontSize}px` : '',
      run.fontFamily ? `font-family:${run.fontFamily}` : '',
      run.bold ? 'font-weight:800' : '',
      run.italic ? 'font-style:oblique 12deg' : '',
      decorations.length ? `text-decoration:${decorations.join(' ')}` : '',
    ].filter(Boolean).join(';')

    return `<span style="${escapeHtml(styles)}">${escapeHtml(run.text).replace(/\n/g, '<br />')}</span>`
  }).join('')
}

function renderPrintCalendar(month, plans) {
  const dailySummary = buildDailySummary(sortPlans(plans))
  const days = buildCalendarDays(month)

  return `
    <section class="print-calendar">
      <div class="print-section-title">
        <h2>${escapeHtml(formatMonthLabel(month))} 캘린더</h2>
      </div>
      <div class="print-calendar-grid">
        ${WEEKDAYS.map((day) => `<div class="print-weekday">${escapeHtml(day)}</div>`).join('')}
        ${days.map((item) => {
          const summary = item.date ? dailySummary[item.date] : null
          const classes = [
            'print-day',
            item.isBlank ? 'is-blank' : '',
            item.isSaturday ? 'is-saturday' : '',
            item.isHoliday ? 'is-holiday' : '',
          ].filter(Boolean).join(' ')

          return `
            <div class="${classes}">
              <div class="print-day-head">
                ${item.day ? `<strong>${item.day}</strong>` : ''}
                ${summary ? `
                  <div class="print-day-badges">
                    <span>${summary.count}건</span>
                    <span>${summary.weightedMin.toLocaleString()}분</span>
                  </div>
                ` : ''}
              </div>
              ${summary ? `
                <div class="print-day-plans">
                  ${summary.plans.map((plan) => `
                    <div class="print-day-plan">
                      <span>${escapeHtml(plan.requestTime || '')}</span>
                      <span>${escapeHtml(plan.dealType || '')}</span>
                      <strong>${escapeHtml(plan.programCodeName || '')}</strong>
                    </div>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          `
        }).join('')}
      </div>
    </section>
  `
}

function openStrategyPdfWindow(month, strategyData, popupTarget, selectedTeamKeys) {
  const allowedTeamKeys = Array.isArray(selectedTeamKeys) && selectedTeamKeys.length > 0
    ? new Set(selectedTeamKeys)
    : null
  const teams = TEAMS
    .filter((team) => !allowedTeamKeys || allowedTeamKeys.has(team.key))
    .map((team) => {
      const data = strategyData?.teams?.[team.key]
      return data ? { ...data, displayName: team.label } : null
    })
    .filter(Boolean)
  const nextMonth = addMonths(month, 1)
  const pages = teams.map((team) => `
    <section class="print-page">
      <header class="print-header">
        <h1>${escapeHtml(formatMonthLabel(month))} 월간 편성 전략</h1>
        <span>${escapeHtml(team.displayName || team.teamName || team.sheetName || '')}</span>
      </header>
      <section class="print-strategy-section">
        <div class="print-section-title">
          <h2>월간 전략</h2>
        </div>
        <div class="print-strategy-grid">
          <article class="print-strategy-card is-current">
            <strong>${escapeHtml(formatMonthLabel(month))}</strong>
            <p>${richTextToHtml(team.strategy?.currentRichText, team.strategy?.currentText)}</p>
          </article>
          <article class="print-strategy-card is-next">
            <strong>${escapeHtml(formatMonthLabel(nextMonth))}</strong>
            <p>${richTextToHtml(team.strategy?.nextRichText, team.strategy?.nextText)}</p>
          </article>
        </div>
      </section>
      ${renderPrintCalendar(month, team.plans || [])}
    </section>
  `).join('')
  const popup = popupTarget || window.open('', '_blank', 'width=1600,height=1000')

  if (!popup) return

  popup.document.write(`<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(formatMonthLabel(month))} 월간 편성 전략 PDF</title>
  <style>
    @page { size: A3 landscape; margin: 10mm; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #f5f5f7; color: #1d1d1f; font-family: Arial, "Noto Sans KR", sans-serif; }
    .print-page { width: 100%; height: 277mm; padding: 0; page-break-after: always; background: #f5f5f7; display: grid; grid-template-rows: 48px 1fr 2fr; gap: 12px; overflow: hidden; }
    .print-page:last-child { page-break-after: auto; }
    .print-header { height: 48px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    .print-header h1 { margin: 0; font-size: 25px; font-weight: 900; letter-spacing: 0; }
    .print-header span { font-size: 14px; font-weight: 800; color: #344054; }
    .print-section-title { height: 34px; display: flex; align-items: center; justify-content: space-between; padding: 0 14px; border: 1px solid #dfe3ea; border-bottom: 0; border-radius: 14px 14px 0 0; background: #fbfbfd; }
    .print-section-title h2 { margin: 0; color: #1d1d1f; font-size: 17px; font-weight: 900; letter-spacing: 0; }
    .print-strategy-section { min-height: 0; display: grid; grid-template-rows: 34px minmax(0, 1fr); }
    .print-strategy-grid { min-height: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; padding: 14px; border: 1px solid #dfe3ea; border-radius: 0 0 14px 14px; background: #fff; }
    .print-strategy-card { position: relative; height: 100%; min-height: 0; overflow: hidden; padding: 18px; border-radius: 12px; background: #f3f8ff; border: 1px solid rgba(47, 128, 237, 0.18); }
    .print-strategy-card::before { content: ''; position: absolute; inset: 0 0 auto; height: 5px; background: #2f80ed; }
    .print-strategy-card.is-next { background: #fff7ed; border-color: rgba(242, 153, 74, 0.22); }
    .print-strategy-card.is-next::before { background: #f2994a; }
    .print-strategy-card strong { display: block; font-size: 20px; font-weight: 900; line-height: 1; }
    .print-strategy-card p { margin: 12px 0 0; font-size: 12px; line-height: 1.45; color: #111827; white-space: normal; }
    .print-calendar { min-height: 0; overflow: hidden; border-radius: 14px; background: #fff; display: grid; grid-template-rows: 34px minmax(0, 1fr); }
    .print-calendar-grid { height: 100%; display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); grid-template-rows: 30px repeat(6, minmax(0, 1fr)); border: 1px solid #dfe3ea; border-radius: 0 0 14px 14px; overflow: hidden; }
    .print-weekday, .print-day { min-width: 0; border-right: 1px solid #dfe3ea; border-bottom: 1px solid #dfe3ea; }
    .print-weekday:nth-child(7n), .print-day:nth-child(7n) { border-right: 0; }
    .print-weekday { display: flex; align-items: center; justify-content: center; background: #fbfbfd; color: #475467; font-size: 11px; font-weight: 900; }
    .print-weekday:first-child, .print-day.is-holiday .print-day-head > strong { color: #d92d20; }
    .print-weekday:nth-child(7), .print-day.is-saturday .print-day-head > strong { color: #1f6feb; }
    .print-day { min-height: 0; overflow: hidden; padding: 8px; background: #fff; }
    .print-day.is-blank { background: #fafafa; }
    .print-day-head { display: flex; align-items: center; gap: 6px; min-width: 0; }
    .print-day-head > strong { flex: 0 0 auto; font-size: 12px; font-weight: 900; }
    .print-day-badges { display: flex; gap: 4px; min-width: 0; }
    .print-day-badges span { height: 18px; padding: 0 6px; border-radius: 999px; background: #eef2ff; color: #334155; font-size: 10px; font-weight: 900; line-height: 18px; white-space: nowrap; }
    .print-day-plans { display: grid; gap: 4px; margin-top: 7px; overflow: hidden; }
    .print-day-plan { display: grid; grid-template-columns: auto auto minmax(0, 1fr); gap: 5px; align-items: center; min-width: 0; padding: 4px 6px; border-radius: 7px; background: #f3f4f6; font-size: 10px; font-weight: 800; line-height: 1.2; }
    .print-day-plan span, .print-day-plan strong { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .print-day-plan span { color: #667085; }
    @media print {
      body { background: #fff; }
      .print-page { height: 277mm; padding: 0; background: #fff; }
    }
  </style>
</head>
<body>
  ${pages || '<section class="print-page"><p>출력할 월간전략 데이터가 없습니다.</p></section>'}
  <script>
    window.addEventListener('load', () => setTimeout(() => window.print(), 150));
  </script>
</body>
</html>`)
  popup.document.close()
  popup.focus()
}

export default function StrategyPage({ month, refreshVersion = 0, onChangeMonth }) {
  const year = Number(month.slice(0, 4))
  const monthNumber = Number(month.slice(4, 6))
  const nextMonth = addMonths(month, 1)
  const calendarDays = buildCalendarDays(month)
  const [selectedTeam, setSelectedTeam] = useState(readCachedTeam)
  const [strategyData, setStrategyData] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [detailSort, setDetailSort] = useState({ key: 'requestDate', direction: 'asc' })
  const [detailColumnWidths, setDetailColumnWidths] = useState(
    Object.fromEntries(DETAIL_COLUMNS.map((column) => [column.key, column.width])),
  )
  const selectedTeamLabel = TEAMS.find((team) => team.key === selectedTeam)?.label || TEAMS[0].label
  const teamData = strategyData?.teams?.[selectedTeam] || null
  const plans = useMemo(() => sortPlans(teamData?.plans || []), [teamData])
  const detailPlans = useMemo(() => {
    return [...plans].sort((a, b) => {
      const aValue = getDetailSortValue(a, detailSort.key)
      const bValue = getDetailSortValue(b, detailSort.key)
      const direction = detailSort.direction === 'asc' ? 1 : -1

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return (aValue - bValue) * direction
      }

      return String(aValue).localeCompare(String(bValue), 'ko') * direction
    })
  }, [detailSort, plans])
  const dailySummary = useMemo(() => buildDailySummary(plans), [plans])

  const sortDetailPlans = (columnKey) => {
    setDetailSort((current) => ({
      key: columnKey,
      direction: current.key === columnKey && current.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  const resizeDetailColumn = (columnKey, event) => {
    event.preventDefault()
    event.stopPropagation()

    const startX = event.clientX
    const startWidth = detailColumnWidths[columnKey]

    const onMouseMove = (moveEvent) => {
      const nextWidth = Math.max(72, startWidth + moveEvent.clientX - startX)
      setDetailColumnWidths((current) => ({ ...current, [columnKey]: nextWidth }))
    }

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  useEffect(() => {
    localStorage.setItem(STRATEGY_TEAM_CACHE_KEY, selectedTeam)
  }, [selectedTeam])

  useEffect(() => {
    const handleExportPdf = (event) => {
      openStrategyPdfWindow(month, strategyData, event.detail?.popup, event.detail?.teamKeys)
    }

    window.addEventListener('msm:export-strategy-pdf', handleExportPdf)
    return () => window.removeEventListener('msm:export-strategy-pdf', handleExportPdf)
  }, [month, strategyData])

  useEffect(() => {
    let ignore = false

    async function loadStrategyData() {
      setIsLoading(true)
      setError('')
      setStrategyData(null)

      try {
        const response = await fetch(`${FIREBASE_BASE_URL}/${STRATEGY_PATH}/${month}.json?ts=${Date.now()}`, {
          cache: 'no-store',
        })
        if (!response.ok) {
          const message = await response.text()
          throw new Error(`Firebase read failed: ${response.status} ${message}`)
        }

        const payload = await response.json()
        if (!ignore) setStrategyData(payload)
      } catch (loadError) {
        if (!ignore) {
          setStrategyData(null)
          setError(loadError.message)
        }
      } finally {
        if (!ignore) setIsLoading(false)
      }
    }

    loadStrategyData()

    return () => {
      ignore = true
    }
  }, [month, refreshVersion])

  return (
    <main className="strategy-page">
      <section className="strategy-period" aria-label="전략 연월 및 조직 선택">
        <div>
          <p className="page-kicker"></p>
          <h1>월간 편성 전략</h1>
        </div>
        <div className="strategy-period-selectors">
          <label>
            <span>연도</span>
            <select
              value={year}
              onChange={(event) => onChangeMonth(`${event.target.value}${String(monthNumber).padStart(2, '0')}`)}
            >
              {YEARS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>월</span>
            <select
              value={monthNumber}
              onChange={(event) => onChangeMonth(`${year}${String(event.target.value).padStart(2, '0')}`)}
            >
              {MONTHS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="is-wide">
            <span>조직</span>
            <select value={selectedTeam} onChange={(event) => setSelectedTeam(event.target.value)}>
              {TEAMS.map((team) => (
                <option key={team.key} value={team.key}>
                  {team.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {(isLoading || error || !teamData) && (
        <section className={`strategy-data-state ${error ? 'is-error' : ''}`}>
          {isLoading && <span>월간전략 데이터를 불러오는 중입니다.</span>}
          {!isLoading && error && <span>{error}</span>}
          {!isLoading && !error && !teamData && <span>{month} {selectedTeamLabel} 데이터가 없습니다.</span>}
        </section>
      )}

      <section className="strategy-plans" aria-label="월간 전략">
        <article
          className="is-current"
          onContextMenu={(event) => openSectionWindow(event, `${formatMonthLabel(month)} ${selectedTeamLabel}`)}
          title="우클릭하면 새창으로 열립니다"
        >
          <strong>{formatMonthLabel(month)}</strong>
          <p>
            <RichTextBlock
              richText={teamData?.strategy?.currentRichText}
              fallback={teamData?.strategy?.currentText || '등록된 선택월 전략이 없습니다.'}
            />
          </p>
        </article>
        <article
          className="is-next"
          onContextMenu={(event) => openSectionWindow(event, `${formatMonthLabel(nextMonth)} ${selectedTeamLabel}`)}
          title="우클릭하면 새창으로 열립니다"
        >
          <strong>{formatMonthLabel(nextMonth)}</strong>
          <p>
            <RichTextBlock
              richText={teamData?.strategy?.nextRichText}
              fallback={teamData?.strategy?.nextText || '등록된 익월 전략이 없습니다.'}
            />
          </p>
        </article>
      </section>

      <section
        className="month-calendar"
        aria-label={`${formatMonthLabel(month)} 캘린더`}
        onContextMenu={(event) => openSectionWindow(event, `${formatMonthLabel(month)} ${selectedTeamLabel} 캘린더`)}
        title="우클릭하면 새창으로 열립니다"
      >
        <div className="calendar-title">
          <h2>{formatMonthLabel(month)} 캘린더</h2>
          <span>{selectedTeamLabel}</span>
        </div>
        <div className="calendar-grid">
          {WEEKDAYS.map((day) => (
            <div className="calendar-weekday" key={day}>
              {day}
            </div>
          ))}
          {calendarDays.map((item) => {
            const summary = item.date ? dailySummary[item.date] : null

            return (
              <div
                className={`calendar-day ${item.isBlank ? 'is-blank' : ''} ${
                  item.isSaturday ? 'is-saturday' : ''
                } ${item.isHoliday ? 'is-holiday' : ''}`}
                key={item.key}
              >
                <div className="calendar-day-head">
                  {item.day && <strong>{item.day}</strong>}
                  {summary && (
                    <div className="calendar-day-summary">
                      <span>{summary.count}건</span>
                      <span>{summary.weightedMin.toLocaleString()}분</span>
                    </div>
                  )}
                </div>
                {summary && (
                  <div className="calendar-day-plans">
                    {summary.plans.map((plan) => (
                      <div className="calendar-day-plan" key={`${plan.sourceRow}-${plan.requestTime}-${plan.programCodeName}`}>
                        <span>{plan.requestTime || ''}</span>
                        <span>{plan.dealType || ''}</span>
                        <strong>{plan.programCodeName || ''}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      <section
        className="request-details"
        onContextMenu={(event) => openSectionWindow(event, `${formatMonthLabel(month)} ${selectedTeamLabel} 상세 요청`)}
        title="우클릭하면 새창으로 열립니다"
      >
        <button
          className="request-details-toggle"
          type="button"
          onClick={() => setIsDetailOpen((current) => !current)}
        >
          상세 요청 {isDetailOpen ? '접기' : '열기'}
          <span>{plans.length.toLocaleString()}건</span>
        </button>

        {isDetailOpen && (
          <div className="request-detail-table-wrap">
            <table className="request-detail-table">
              <colgroup>
                {DETAIL_COLUMNS.map((column) => (
                  <col key={column.key} style={{ width: `${detailColumnWidths[column.key]}px` }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  {DETAIL_COLUMNS.map((column) => (
                    <th
                      aria-sort={
                        detailSort.key === column.key
                          ? detailSort.direction === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : 'none'
                      }
                      key={column.key}
                    >
                      <button
                        className="request-detail-sort-button"
                        type="button"
                        onClick={() => sortDetailPlans(column.key)}
                      >
                        <span>{column.label}</span>
                        {detailSort.key === column.key && (
                          <b aria-hidden="true">{detailSort.direction === 'asc' ? '▲' : '▼'}</b>
                        )}
                      </button>
                      <span
                        className="request-detail-resize-handle"
                        onMouseDown={(event) => resizeDetailColumn(column.key, event)}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {plans.length === 0 && (
                  <tr>
                    <td colSpan="9">상세 요청 목록이 없습니다.</td>
                  </tr>
                )}
                {detailPlans.map((plan) => (
                  <tr key={`${plan.sourceRow}-${plan.requestDate}-${plan.requestTime}`}>
                    <td>{formatDateLabel(plan.requestDate)}</td>
                    <td>{plan.requestTime || ''}</td>
                    <td>{plan.mdCategory || ''}</td>
                    <td>{plan.programCodeName || ''}</td>
                    <td>{plan.dealType || ''}</td>
                    <td>{Number(plan.weightedMin || 0).toLocaleString()}</td>
                    <td>{formatWon(plan.expectedRevenue)}</td>
                    <td>{formatWon(plan.expectedProfit)}</td>
                    <td>{plan.remark || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}
