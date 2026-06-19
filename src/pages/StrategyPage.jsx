import './StrategyPage.css'

export default function StrategyPage() {
  return (
    <main className="strategy-page">
      <section className="strategy-hero">
        <p className="page-kicker">MONTHLY PROGRAMMING STRATEGY</p>
        <h1>월간 편성 전략</h1>
        <p>월간 목표, 카테고리 운영 방향, 브랜드 배분 전략을 구성할 화면입니다.</p>
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
