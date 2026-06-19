import { useState } from 'react'

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1]
const MONTHS_LIST = Array.from({ length: 12 }, (_, i) => i + 1)

function formatMonth(y, m) {
  return `${y}년 ${m}월`
}

export default function MonthSelect({ onConfirm }) {
  const [year, setYear] = useState(CURRENT_YEAR)
  const [month, setMonth] = useState(new Date().getMonth() + 1)

  const handleConfirm = async () => {
    const ym = `${year}${String(month).padStart(2, '0')}`
    await onConfirm(ym)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8f8f6',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '"Pretendard", "Apple SD Gothic Neo", sans-serif',
    }}>
      <div style={{ width: 420 }}>

        <div style={{ marginBottom: 40 }}>
          <p style={{ fontSize: 12, letterSpacing: '0.15em', color: '#999', marginBottom: 8 }}>
            MONTHLY STRATEGY MEETING
          </p>
          <h1 style={{ fontSize: 28, fontWeight: 600, color: '#111', margin: 0 }}>
            분석 월을 선택하세요
          </h1>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            style={{
              flex: 1,
              padding: '12px 16px',
              border: '1px solid #e0e0e0',
              borderRadius: 8,
              fontSize: 14,
              background: '#fff',
              color: '#111',
              cursor: 'pointer',
            }}
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>{y}년</option>
            ))}
          </select>

          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            style={{
              flex: 2,
              padding: '12px 16px',
              border: '1px solid #e0e0e0',
              borderRadius: 8,
              fontSize: 14,
              background: '#fff',
              color: '#111',
              cursor: 'pointer',
            }}
          >
            {MONTHS_LIST.map((m) => (
              <option key={m} value={m}>{m}월</option>
            ))}
          </select>
        </div>

        <button
          onClick={handleConfirm}
          style={{
            width: '100%',
            padding: '16px 0',
            background: '#111',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            letterSpacing: '0.05em',
          }}
        >
          {formatMonth(year, month)} 데이터 불러오기
        </button>

      </div>
    </div>
  )
}