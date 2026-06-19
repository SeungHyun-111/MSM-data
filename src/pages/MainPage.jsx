import './MainPage.css'

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1]
const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1)

export default function MainPage({ month, onChangeMonth }) {
  const year = Number(month.slice(0, 4))
  const monthNumber = Number(month.slice(4, 6))
  const selectedMonth = `${year}${String(monthNumber).padStart(2, '0')}`

  return (
    <main className="main-page">
      <section className="main-hero">
        <p className="page-kicker">MONTHLY STRATEGY MEETING</p>
        <h1>메인페이지</h1>
        <p>연월을 선택하고, 해당 월의 DB 데이터 준비 상태를 확인합니다.</p>
      </section>

      <section className="month-panel" aria-label="분석 연월 선택">
        <div className="month-selectors">
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
        </div>

        <div className="selected-month">
          <small>선택 연월</small>
          <strong>{selectedMonth}</strong>
        </div>
      </section>

      <section className="db-overview" aria-label="DB 데이터 현황">
        <div className="section-title">
          <h2>DB 데이터 현황</h2>
          <span>{selectedMonth}</span>
        </div>

        <div className="status-grid">
          <article>
            <span className="status-label">경쟁사 편성</span>
            <strong>확인 대기</strong>
            <p>RTDB 연동 전 표시 영역입니다.</p>
          </article>
          <article>
            <span className="status-label">월간 편성 전략</span>
            <strong>확인 대기</strong>
            <p>전략 데이터 현황을 표시할 자리입니다.</p>
          </article>
          <article>
            <span className="status-label">최근 갱신일자</span>
            <strong>-</strong>
            <p>Firebase 연결 후 updatedAt을 표시합니다.</p>
          </article>
        </div>
      </section>
    </main>
  )
}
