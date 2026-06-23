import './MainPage.css'

export default function MainPage() {
  return (
    <main className="main-page">
      <section className="main-hero">
        <p className="page-kicker">MONTHLY STRATEGY MEETING</p>
        <h1>메인페이지</h1>
        <p>경쟁사 편성은 전월 기준, 월간 편성 전략은 익월 기준으로 각 페이지에서 확인합니다.</p>
      </section>

      <section className="db-overview" aria-label="DB 데이터 현황">
        <div className="section-title">
          <h2>DB 데이터 현황</h2>
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
