import { Fragment, useEffect, useMemo, useState } from 'react'
import './Dashboard.css'

const FIREBASE_BASE_URL = 'https://schedule-7ec7a-default-rtdb.asia-southeast1.firebasedatabase.app'
const FIREBASE_MSM_PATH = 'competitorInfo/monthly'
const SHEETS = [
  { key: 'SSG', label: 'SSG', accent: '#f4a261' },
  { key: 'K', label: 'K', accent: '#7aa7d9' },
  { key: 'SK', label: 'SK스토아', accent: '#e98b8b' },
]
const BROADCAST_COLUMNS = [
  { key: 'time', label: '방송일시', width: 170 },
  { key: 'brand', label: '브랜드', width: 150 },
  { key: 'productName', label: '상품명', width: 740 },
  { key: 'weight', label: '가중분', width: 100 },
  { key: 'revenue', label: '매출액', width: 170 },
  { key: 'revenuePerMinute', label: '분당 매출액', width: 170 },
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

function buildBroadcastsByBrand(rows) {
  const map = new Map()

  rows.forEach((row) => {
    const brand = String(row.brand || '').trim()
    if (!brand) return

    const key = getPgmKey(row)
    const brandRows = map.get(brand) || new Map()
    const current =
      brandRows.get(key) || {
        key,
        brand,
        month: row.month,
        date: row.date,
        hour: row.hour,
        minute: row.minute,
        productName: row.productName,
        weight: 0,
        revenue: 0,
      }

    current.weight += getWeight(row)
    current.revenue += getRevenue(row)
    brandRows.set(key, current)
    map.set(brand, brandRows)
  })

  return Object.fromEntries(
    [...map.entries()].map(([brand, rowsByPgm]) => [
      brand,
      [...rowsByPgm.values()].sort((a, b) =>
        [a.date, a.hour, a.minute, a.productName].join('|').localeCompare(
          [b.date, b.hour, b.minute, b.productName].join('|'),
        ),
      ),
    ]),
  )
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
      broadcastsByBrand: buildBroadcastsByBrand(selectedRowsBySheet[sheet.key]),
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

function formatWon(value) {
  return `${Math.round(value).toLocaleString()}원`
}

function formatWonPerMinute(revenue, minutes) {
  if (!minutes) return '-'
  return `${Math.round(revenue / minutes).toLocaleString()}원/분`
}

function formatBroadcastTime(row) {
  const weekdays = ['일', '월', '화', '수', '목', '금', '토']
  const rawDate = String(row.date || '')
  const datePart = rawDate.split('T')[0]
  const parsedDate = datePart ? new Date(`${datePart}T00:00:00`) : null
  const weekday =
    parsedDate && !Number.isNaN(parsedDate.getTime()) ? `(${weekdays[parsedDate.getDay()]})` : ''
  const time =
    row.hour !== undefined && row.minute !== undefined
      ? `${String(row.hour).padStart(2, '0')}:${String(row.minute).padStart(2, '0')}`
      : ''
  return [datePart, weekday, time].filter(Boolean).join(' ')
}

function getSelectedChannelOrder(selectedCompanyKey) {
  return [
    selectedCompanyKey,
    ...SHEETS.map((sheet) => sheet.key).filter((key) => key !== selectedCompanyKey),
  ]
}

function getBroadcastSortValue(row, sortKey) {
  if (sortKey === 'time') {
    const date = String(row.date || '').split('T')[0]
    const hour = String(row.hour ?? '').padStart(2, '0')
    const minute = String(row.minute ?? '').padStart(2, '0')
    return `${date} ${hour}:${minute}`
  }
  if (sortKey === 'brand') return String(row.brand || '').toLowerCase()
  if (sortKey === 'productName') return String(row.productName || '').toLowerCase()
  if (sortKey === 'weight') return row.weight
  if (sortKey === 'revenue') return row.revenue
  if (sortKey === 'revenuePerMinute') return row.weight ? row.revenue / row.weight : 0
  return ''
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
  const [selectedBrand, setSelectedBrand] = useState(null)
  const [broadcastSort, setBroadcastSort] = useState({ key: 'time', direction: 'asc' })
  const [broadcastColumnWidths, setBroadcastColumnWidths] = useState(
    Object.fromEntries(BROADCAST_COLUMNS.map((column) => [column.key, column.width])),
  )

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
      } catch {
        // Keep the dashboard usable with cached or empty data when remote refresh fails.
      }
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
      } catch {
        // Previous month data is optional; deltas fall back to zero when it is unavailable.
      }
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
  const activeSelectedBrand =
    selectedBrand?.month === month && selectedBrand?.mdCategory === mdCategory ? selectedBrand : null
  const selectedCompany = activeSelectedBrand
    ? analysis.find((company) => company.key === activeSelectedBrand.companyKey)
    : null
  const selectedChannelOrder = activeSelectedBrand ? getSelectedChannelOrder(activeSelectedBrand.companyKey) : []
  const selectedBroadcastGroups = activeSelectedBrand
    ? selectedChannelOrder.map((companyKey) => {
        const company = analysis.find((item) => item.key === companyKey)
        const broadcasts = company?.broadcastsByBrand[activeSelectedBrand.brand] || []

        return {
          key: companyKey,
          label: company?.label || companyKey,
          accent: company?.accent || '#6e6e73',
          broadcasts: broadcasts.map((broadcast) => ({
            ...broadcast,
            key: `${companyKey}-${broadcast.key}`,
          })),
        }
      })
    : []
  const sortedBroadcastGroups = selectedBroadcastGroups.map((group) => ({
    ...group,
    broadcasts: group.broadcasts.slice().sort((a, b) => {
      const aValue = getBroadcastSortValue(a, broadcastSort.key)
      const bValue = getBroadcastSortValue(b, broadcastSort.key)
      const direction = broadcastSort.direction === 'asc' ? 1 : -1

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return (aValue - bValue) * direction
      }
      return String(aValue).localeCompare(String(bValue), 'ko') * direction
    }),
  }))

  const showTooltip = (event, tooltip) => {
    setActiveTooltip({ ...tooltip, x: event.clientX, y: event.clientY })
  }

  const moveTooltip = (event) => {
    setActiveTooltip((current) => current && { ...current, x: event.clientX, y: event.clientY })
  }

  const hideTooltip = () => {
    setActiveTooltip(null)
  }

  const selectBrand = (companyKey, brand) => {
    setSelectedBrand((current) =>
      current?.companyKey === companyKey &&
      current?.brand === brand &&
      current?.month === month &&
      current?.mdCategory === mdCategory
        ? null
        : { companyKey, brand, month, mdCategory },
    )
  }

  const sortBroadcasts = (columnKey) => {
    setBroadcastSort((current) => ({
      key: columnKey,
      direction: current.key === columnKey && current.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  const resizeBroadcastColumn = (columnKey, event) => {
    event.preventDefault()
    event.stopPropagation()

    const startX = event.clientX
    const startWidth = broadcastColumnWidths[columnKey]

    const onMouseMove = (moveEvent) => {
      const nextWidth = Math.max(70, startWidth + moveEvent.clientX - startX)
      setBroadcastColumnWidths((current) => ({ ...current, [columnKey]: nextWidth }))
    }

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
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
        {analysis.map((company) => {
          const isCompanySelected = activeSelectedBrand?.companyKey === company.key

          return (
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
                      <th>방송횟수</th>
                      <th>{company.key === 'SK' ? '경쟁사운영여부' : '당사운영여부'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {company.rows.map((row) => {
                      const previous = previousBrandStats[company.key][row.brand] || emptyStats

                      return (
                        <tr
                          className={`brand-row ${row.isOperated ? '' : 'not-operated'} ${
                            isCompanySelected && activeSelectedBrand.brand === row.brand ? 'is-selected' : ''
                          }`}
                          key={`${company.key}-${row.brand}`}
                          tabIndex="0"
                          aria-pressed={isCompanySelected && activeSelectedBrand.brand === row.brand}
                          onClick={() => selectBrand(company.key, row.brand)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              selectBrand(company.key, row.brand)
                            }
                          }}
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
                          <td>{row.pgmCount.toLocaleString()}</td>
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
                        <td />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
          )
        })}
      </section>

      {showBrandDetail && (
        <section className="broadcast-section" aria-label="선택 브랜드 방송 목록">
          {!activeSelectedBrand ? (
            <p className="broadcast-empty">브랜드 행을 클릭하세요</p>
          ) : (
            <>
              <div className="broadcast-summary">
                <strong>
                  {selectedCompany?.label} · {activeSelectedBrand.brand}
                </strong>
              </div>
              <table className="broadcast-table">
                <colgroup>
                  {BROADCAST_COLUMNS.map((column) => (
                    <col key={column.key} style={{ width: `${broadcastColumnWidths[column.key]}px` }} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    {BROADCAST_COLUMNS.map((column) => (
                      <th
                        aria-sort={
                          broadcastSort.key === column.key
                            ? broadcastSort.direction === 'asc'
                              ? 'ascending'
                              : 'descending'
                            : 'none'
                        }
                        key={column.key}
                      >
                        <button className="broadcast-sort-button" type="button" onClick={() => sortBroadcasts(column.key)}>
                          <span>{column.label}</span>
                          {broadcastSort.key === column.key && (
                            <b aria-hidden="true">{broadcastSort.direction === 'asc' ? '▲' : '▼'}</b>
                          )}
                        </button>
                        <span
                          className="broadcast-resize-handle"
                          onMouseDown={(event) => resizeBroadcastColumn(column.key, event)}
                        />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedBroadcastGroups.map((group) => (
                    <Fragment key={group.key}>
                      <tr className="broadcast-channel-row" style={{ '--channel-accent': group.accent }}>
                        <td colSpan="6">
                          <div className="broadcast-channel-summary">
                            <strong>{group.label}</strong>
                            <span>{group.broadcasts.length.toLocaleString()}회</span>
                            <span>
                              {formatWon(group.broadcasts.reduce((sum, row) => sum + row.revenue, 0))}
                            </span>
                            <span>
                              {formatWonPerMinute(
                                group.broadcasts.reduce((sum, row) => sum + row.revenue, 0),
                                group.broadcasts.reduce((sum, row) => sum + row.weight, 0),
                              )}
                            </span>
                          </div>
                        </td>
                      </tr>
                      {group.broadcasts.length ? (
                        group.broadcasts.map((broadcast) => (
                          <tr key={broadcast.key}>
                            <td>{formatBroadcastTime(broadcast)}</td>
                            <td>{broadcast.brand || activeSelectedBrand.brand}</td>
                            <td>{broadcast.productName || '-'}</td>
                            <td>{Math.round(broadcast.weight).toLocaleString()}</td>
                            <td>{formatWon(broadcast.revenue)}</td>
                            <td>{formatWonPerMinute(broadcast.revenue, broadcast.weight)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr className="not-operated-channel">
                          <td colSpan="6">미운영</td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </section>
      )}

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
