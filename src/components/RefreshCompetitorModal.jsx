import { useState } from 'react'
import './RefreshCompetitorModal.css'

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1]
const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1)

function formatCounts(counts) {
  if (!counts) return null
  return Object.entries(counts)
    .map(([name, count]) => `${name} ${count}건`)
    .join(' / ')
}

export default function RefreshCompetitorModal({
  defaultMonth,
  isRefreshing,
  onClose,
  onRefresh,
  status,
  title = '데이터 갱신',
}) {
  const initialYear = defaultMonth ? Number(defaultMonth.slice(0, 4)) : CURRENT_YEAR
  const initialMonth = defaultMonth ? Number(defaultMonth.slice(4, 6)) : new Date().getMonth() + 1
  const [year, setYear] = useState(initialYear)
  const [month, setMonth] = useState(initialMonth)
  const selectedMonth = `${year}${String(month).padStart(2, '0')}`
  const countsText = formatCounts(status?.counts)
  const isSuccess = status?.type === 'success'

  const handleSubmit = (event) => {
    event.preventDefault()
    if (isSuccess) return
    onRefresh(selectedMonth)
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="refresh-modal" onSubmit={handleSubmit}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button type="button" onClick={onClose} aria-label="닫기" disabled={isRefreshing}>
            ×
          </button>
        </div>

        <div className="modal-fields">
          <label>
            <span>연도</span>
            <select
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
              disabled={isRefreshing}
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
              value={month}
              onChange={(event) => setMonth(Number(event.target.value))}
              disabled={isRefreshing}
            >
              {MONTHS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className={`refresh-status ${status?.type || 'idle'}`}>
          {isRefreshing && <span className="spinner" aria-hidden="true" />}
          <div>
            <strong>{status?.message || `${selectedMonth} 데이터를 불러올 준비가 되었습니다.`}</strong>
            {countsText && <p>{countsText}</p>}
            {status?.detail && <p>{status.detail}</p>}
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" onClick={onClose} disabled={isRefreshing}>
            닫기
          </button>
          {!isSuccess && (
            <button type="submit" disabled={isRefreshing}>
              {isRefreshing ? '갱신 중' : '갱신하기'}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
