import './Dashboard.css'

function countRows(data) {
  if (!data) return 0
  return Object.values(data).reduce((sum, rows) => sum + rows.length, 0)
}

export default function Dashboard({ month, data }) {
  const totalRows = countRows(data)

  return (
    <main className="dashboard">
      <section className="dashboard-hero">
        <p className="dashboard-kicker">MONTHLY STRATEGY MEETING</p>
        <div className="dashboard-title-row">
          <div>
            <h1>Competitor Programming</h1>
            <p className="dashboard-subtitle">{month} competitor schedule analysis</p>
          </div>
          <div className="dashboard-stat">
            <span>{totalRows.toLocaleString()}</span>
            <small>loaded rows</small>
          </div>
        </div>
      </section>

      <section className="dashboard-grid" aria-label="Dashboard summary">
        <article>
          <h2>경쟁사 편성</h2>
          <p>SSG, K, SK 편성 데이터를 월별로 불러와 비교합니다.</p>
        </article>
        <article>
          <h2>월간 편성 전략</h2>
          <p>시간대, 카테고리, 브랜드 기준으로 다음 편성 전략을 정리합니다.</p>
        </article>
      </section>
    </main>
  )
}
