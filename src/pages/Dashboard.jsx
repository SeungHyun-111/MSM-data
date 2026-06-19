import { useEffect, useMemo, useState } from 'react'
import './Dashboard.css'

const FIREBASE_BASE_URL = 'https://schedule-7ec7a-default-rtdb.asia-southeast1.firebasedatabase.app'
const FIREBASE_MSM_PATH = 'competitorInfo/monthly'
const SHEETS = [
  { key: 'SSG', label: 'SSG', accent: '#f4a261' },
  { key: 'K', label: 'K', accent: '#7aa7d9' },
  { key: 'SK', label: 'SK스토아', accent: '#e98b8b' },
]

function cacheKey(month) {
  return `msm:competitor:${month}`
}

function previousMonth(month) {
  const year = Number(month.slice(0, 4))
  const monthNumber = Number(month.slice(4, 6))
  const date = new Date(year, monthNumber - 2, 1)
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`
}

function toNumber(value) {
  const number = Number(String(value ?? '').replace(/,/g, ''))
  return Number.isFinite(number) ? number : 0
}

function getWeight(row) {
  return toNumber(row.brandWeightedMin || row.weightedMin || row.simpleMin)
}

function getRevenue(row) {
  return toNumber(row.revenue)
}

function getPgmKey(row) {
  return [row.date, row.hour, row.minute, row.brand, row.productName].join('|')
}

function getPgmCount(rows) {
  return new Set(rows.map(getPgmKey)).size
}

function uniqueValues(rows, key) {
  return [...new Set(rows.map((row) => row[key]).filter(Boolean))].sort()
}

function aggregateByBrand(rows) {
  const map = new Map()

  rows.forEach((row) => {
    const brand = String(row.brand || '').trim()
    if (!brand) return
    const current = map.get(brand) || { brand, weight: 0, revenue: 0, pgmKeys: new Set(), month: row.month }
    current.weight += getWeight(row)
    current.revenue += getRevenue(row)
    current.pgmKeys.add(getPgmKey(row))
    map.set(brand, current)
  })

  return [...map.values()]
    .map((row) => ({ ...row, pgmCount: row.pgmKeys.size, pgmKeys: undefined }))
    .sort((a, b) => b.weight - a.weight)
}

function buildAnalysis(data, mdCategory) {
  const allRowsBySheet = Object.fromEntries(SHEETS.map(({ key }) => [key, data?.[key] || []]))
  const selectedRowsBySheet = Object.fromEntries(
    SHEETS.map(({ key }) => [
      key,
      allRowsBySheet[key].filter((row) => mdCategory === 'ALL' || row.mdCategory === mdCategory),
    ]),
  )
  const brandRows = Object.fromEntries(SHEETS.map(({ key }) => [key, aggregateByBrand(selectedRowsBySheet[key])]))
  const skBrands = new Set(brandRows.SK.map((row) => row.brand))
  const competitorBrands = new Set([...brandRows.SSG, ...brandRows.K].map((row) => row.brand))

  return SHEETS.map((sheet) => {
    const rows = brandRows[sheet.key].map((row) => {
      const isOperated = sheet.key === 'SK' ? competitorBrands.has(row.brand) : skBrands.has(row.brand)
      return { ...row, isOperated }
    })
    const selectedWeight = selectedRowsBySheet[sheet.key].reduce((sum, row) => sum + getWeight(row), 0)
    const monthlyWeight = allRowsBySheet[sheet.key].reduce((sum, row) => sum + getWeight(row), 0)
    const operatedCount = rows.filter((row) => row.isOperated).length

    return {
      ...sheet,
      rows,
      selectedWeight,
      monthlyWeight,
      share: monthlyWeight ? (selectedWeight / monthlyWeight) * 100 : 0,
      brandCount: rows.length,
      operatedCount,
    }
  })
}

function getMonthlyStats(data, mdCategory, sheetKey) {
  const rows = (data?.[sheetKey] || []).filter((row) => mdCategory === 'ALL' || row.mdCategory === mdCategory)
  return {
    pgmCount: getPgmCount(rows),
    weight: rows.reduce((sum, row) => sum + getWeight(row), 0),
    revenue: rows.reduce((sum, row) => sum + getRevenue(row), 0),
  }
}

function getBrandStats(data, mdCategory, sheetKey) {
  const rows = (data?.[sheetKey] || []).filter((row) => mdCategory === 'ALL' || row.mdCategory === mdCategory)
  return Object.fromEntries(
    aggregateByBrand(rows).map((row) => [
      row.brand,
      {
        pgmCount: row.pgmCount,
        weight: row.weight,
        revenue: row.revenue,
      },
    ]),
  )
}

function formatDelta(value, unit = '') {
  const rounded = Math.round(value)
  if (rounded === 0) return `0${unit}`
  return `${rounded > 0 ? '+' : ''}${rounded.toLocaleString()}${unit}`
}

function formatMoney(value) {
  return `${Math.round(value / 1000000).toLocaleString()}백만`
}

function formatMoneyDelta(value) {
  const rounded = Math.round(value / 1000000)
  if (rounded === 0) return '0백만'
  return `${rounded > 0 ? '+' : ''}${rounded.toLocaleString()}백만`
}

function brandNameClass(brand) {
  const length = String(brand || '').length
  if (length >= 14) return 'brand-name is-tiny'
  if (length >= 10) return 'brand-name is-small'
  return 'brand-name'
}

function makeTooltipRows(current, previous) {
  return [
    {
      label: 'PGM수',
      value: `${current.pgmCount.toLocaleString()}건`,
      delta: formatDelta(current.pgmCount - previous.pgmCount, '건'),
    },
    {
      label: '가중분',
      value: `${Math.round(current.weight).toLocaleString()}분`,
      delta: formatDelta(current.weight - previous.weight, '분'),
    },
    {
      label: '매출액',
      value: formatMoney(current.revenue),
      delta: formatMoneyDelta(current.revenue - previous.revenue),
    },
  ]
}

const emptyStats = { pgmCount: 0, weight: 0, revenue: 0 }

export default function Dashboard({ month, data }) {
  const [rawData, setRawData] = useState(data)
  const [previousData, setPreviousData] = useState(null)
  const [mdCategory, setMdCategory] = useState('ALL')
  const [activeTooltip, setActiveTooltip] = useState(null)

  useEffect(() => {
    let ignore = false

    const loadData = async () => {
      setRawData(data || null)

      if (data) {
        localStorage.setItem(cacheKey(month), JSON.stringify(data))
        return
      }

      const cached = localStorage.getItem(cacheKey(month))
      if (cached) {
        try {
          const parsed = JSON.parse(cached)
          if (!ignore) setRawData(parsed)
        } catch {
          localStorage.removeItem(cacheKey(month))
        }
      }

      try {
        const res = await fetch(`${FIREBASE_BASE_URL}/${FIREBASE_MSM_PATH}/${month}.json`)
        if (!res.ok) throw new Error('Firebase read failed')
        const payload = await res.json()
        if (!payload?.data) throw new Error('No monthly data')

        if (!ignore) {
          setRawData(payload.data)
          localStorage.setItem(cacheKey(month), JSON.stringify(payload.data))
        }
      } catch {}
    }

    loadData()

    return () => {
      ignore = true
    }
  }, [data, month])

  useEffect(() => {
    let ignore = false
    const prevMonth = previousMonth(month)

    const loadPreviousData = async () => {
      setPreviousData(null)

      const cached = localStorage.getItem(cacheKey(prevMonth))
      if (cached) {
        try {
          const parsed = JSON.parse(cached)
          if (!ignore) setPreviousData(parsed)
        } catch {
          localStorage.removeItem(cacheKey(prevMonth))
        }
      }

      try {
        const res = await fetch(`${FIREBASE_BASE_URL}/${FIREBASE_MSM_PATH}/${prevMonth}.json`)
        if (!res.ok) throw new Error('Firebase read failed')
        const payload = await res.json()
        if (!payload?.data) throw new Error('No monthly data')

        if (!ignore) {
          setPreviousData(payload.data)
          localStorage.setItem(cacheKey(prevMonth), JSON.stringify(payload.data))
        }
      } catch {}
    }

    loadPreviousData()

    return () => {
      ignore = true
    }
  }, [month])

  const allRows = useMemo(() => Object.values(rawData || {}).flat(), [rawData])
  const mdCategories = useMemo(() => uniqueValues(allRows, 'mdCategory'), [allRows])
  const analysis = useMemo(() => buildAnalysis(rawData, mdCategory), [rawData, mdCategory])
  const currentStats = useMemo(
    () => Object.fromEntries(SHEETS.map(({ key }) => [key, getMonthlyStats(rawData, mdCategory, key)])),
    [mdCategory, rawData],
  )
  const previousStats = useMemo(
    () => Object.fromEntries(SHEETS.map(({ key }) => [key, getMonthlyStats(previousData, mdCategory, key)])),
    [mdCategory, previousData],
  )
  const previousBrandStats = useMemo(
    () => Object.fromEntries(SHEETS.map(({ key }) => [key, getBrandStats(previousData, mdCategory, key)])),
    [mdCategory, previousData],
  )
  const rankedCompanies = useMemo(
    () => analysis.slice().sort((a, b) => b.brandCount - a.brandCount),
    [analysis],
  )
  const maxBrandRows = useMemo(
    () => Math.max(0, ...analysis.map((company) => company.rows.length)),
    [analysis],
  )
  const showBrandDetail = mdCategory !== 'ALL'

  const showTooltip = (event, tooltip) => {
    setActiveTooltip({ ...tooltip, x: event.clientX, y: event.clientY })
  }

  const moveTooltip = (event) => {
    setActiveTooltip((current) => current && { ...current, x: event.clientX, y: event.clientY })
  }

  const hideTooltip = () => {
    setActiveTooltip(null)
  }

  return (
    <main className="dashboard">
      <section className="sheet-top">
        <div className="selector-sheet" aria-label="월 MD분류 선택">
          <div className="selector-values">
            <label>
              <span>월</span>
              <strong>{month}</strong>
            </label>
            <label>
              <span>MD분류</span>
              <select value={mdCategory} onChange={(event) => setMdCategory(event.target.value)}>
                <option value="ALL">전체</option>
                {mdCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <table className="brand-rank" aria-label="회사별 브랜드수">
          <thead>
            <tr>
              <th />
              <th>회사명</th>
              <th>브랜드수</th>
            </tr>
          </thead>
          <tbody>
            {rankedCompanies.map((company, index) => (
              <tr key={company.key}>
                <td>{index + 1}</td>
                <td>{company.label}</td>
                <td>{company.brandCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="competitor-board" aria-label="브랜드별 편성 현황">
        {analysis.map((company) => (
          <article className="company-card" key={company.key}>
            <div className="share-strip">
              <span>편성비중</span>
              <strong>{company.share.toFixed(1)}%</strong>
              <button
                className="delta-trigger"
                type="button"
                aria-label={`${company.label} 전월대비 증감`}
                onMouseEnter={(event) =>
                  showTooltip(event, {
                    title: `${company.label} · ${previousMonth(month)} 대비`,
                    rows: makeTooltipRows(currentStats[company.key], previousStats[company.key]),
                  })
                }
                onMouseMove={moveTooltip}
                onMouseLeave={hideTooltip}
                onFocus={(event) =>
                  showTooltip(event, {
                    title: `${company.label} · ${previousMonth(month)} 대비`,
                    rows: makeTooltipRows(currentStats[company.key], previousStats[company.key]),
                  })
                }
                onBlur={hideTooltip}
              >
                전월대비
              </button>
            </div>

            <div className="company-name" style={{ background: company.accent }}>
              {company.label}
            </div>

            <div className="company-metrics">
              <p>
                <span>전체브랜드</span>
                <strong>{company.brandCount}</strong>
              </p>
              <p>
                <span>{company.key === 'SK' ? '경쟁사운영브랜드' : '당사운영브랜드'}</span>
                <strong>{company.operatedCount}</strong>
              </p>
            </div>

            {showBrandDetail && (
              <div className="brand-table-wrap">
                <table className="brand-table">
                  <thead>
                    <tr>
                      <th>연월</th>
                      <th>브랜드</th>
                      <th>가중분(계)</th>
                      <th>{company.key === 'SK' ? '경쟁사운영여부' : '당사운영여부'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {company.rows.map((row) => {
                      const previous = previousBrandStats[company.key][row.brand] || emptyStats

                      return (
                        <tr
                          className={`brand-row ${row.isOperated ? '' : 'not-operated'}`}
                          key={`${company.key}-${row.brand}`}
                        >
                          <td>{row.month}</td>
                          <td
                            className="brand-cell"
                            tabIndex="0"
                            onMouseEnter={(event) =>
                              showTooltip(event, {
                                title: `${row.brand} · ${previousMonth(month)} 대비`,
                                rows: makeTooltipRows(row, previous),
                              })
                            }
                            onMouseMove={moveTooltip}
                            onMouseLeave={hideTooltip}
                            onFocus={(event) =>
                              showTooltip(event, {
                                title: `${row.brand} · ${previousMonth(month)} 대비`,
                                rows: makeTooltipRows(row, previous),
                              })
                            }
                            onBlur={hideTooltip}
                          >
                          <strong className={brandNameClass(row.brand)}>{row.brand}</strong>
                          </td>
                          <td>{Math.round(row.weight).toLocaleString()}</td>
                          <td className={row.isOperated ? 'yes' : 'no'}>{row.isOperated ? 'Y' : 'N'}</td>
                        </tr>
                      )
                    })}
                    {Array.from({ length: Math.max(0, maxBrandRows - company.rows.length) }).map((_, index) => (
                      <tr className="empty-row" key={`${company.key}-empty-${index}`}>
                        <td />
                        <td />
                        <td />
                        <td />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        ))}
      </section>

      {activeTooltip && (
        <div
          className="floating-tooltip"
          style={{
            left: Math.min(activeTooltip.x + 18, window.innerWidth - 286),
            top: Math.min(activeTooltip.y + 18, window.innerHeight - 178),
          }}
          role="tooltip"
        >
          <b>{activeTooltip.title}</b>
          {activeTooltip.rows.map((row) => (
            <em key={row.label}>
              <span>{row.label}</span>
              <strong>
                {row.value} ({row.delta})
              </strong>
            </em>
          ))}
        </div>
      )}
    </main>
  )
}
