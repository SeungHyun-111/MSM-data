import './StrategyPage.css'

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1]
const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1)

export default function StrategyPage({ month, onChangeMonth }) {
  const year = Number(month.slice(0, 4))
  const monthNumber = Number(month.slice(4, 6))

  return (
    <main className="strategy-page">
      <section className="strategy-hero">
        <p className="page-kicker">MONTHLY PROGRAMMING STRATEGY</p>
        <h1>월간 편성 전략</h1>
        <p>월간 목표, 카테고리 운영 방향, 브랜드 배분 전략을 구성하는 화면입니다.</p>
      </section>

      <section className="strategy-period" aria-label="전략 연월 선택">
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
        </div>
        <div className="strategy-period-value">
          <span>전략 기준월</span>
          <strong>{month}</strong>
        </div>
      </section>

      <section className="strategy-grid" aria-label="월간 편성 전략 구성">
        <article>
          <h2>월간 목표</h2>
          <p>매출, 가중분, 카테고리 목표를 배치할 영역입니다.</p>
        </article>
        <article>
          <h2>카테고리 전략</h2>
          <p>MD 카테고리별 편성 방향을 정리할 영역입니다.</p>
        </article>
        <article>
          <h2>브랜드 운영</h2>
          <p>브랜드별 집중 운영 계획을 표시할 영역입니다.</p>
        </article>
      </section>
    </main>
  )
}
