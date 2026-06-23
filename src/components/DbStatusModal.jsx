import './DbStatusModal.css'

function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export default function DbStatusModal({ error, isLoading, sections, onClose }) {
  const hasRows = sections.some((section) => section.rows.length > 0)

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="db-status-modal" aria-modal="true" role="dialog">
        <div className="modal-header">
          <h2>DB 현황</h2>
          <button type="button" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>

        <div className="db-status-body">
          {isLoading && (
            <div className="db-status-state">
              <span className="spinner" aria-hidden="true" />
              <strong>Firebase DB 현황을 불러오고 있습니다.</strong>
            </div>
          )}

          {!isLoading && error && (
            <div className="db-status-state error">
              <strong>DB 현황을 불러오지 못했습니다.</strong>
              <p>{error}</p>
            </div>
          )}

          {!isLoading && !error && !hasRows && (
            <div className="db-status-state">
              <strong>저장된 월 데이터가 없습니다.</strong>
            </div>
          )}

          {!isLoading && !error && hasRows && (
            <div className="db-status-sections">
              {sections.map((section) => (
                <section className="db-status-section" key={section.id}>
                  <h3>{section.title}</h3>
                  {section.rows.length === 0 ? (
                    <div className="db-status-empty">저장된 데이터가 없습니다.</div>
                  ) : (
                    <table className="db-status-table">
                      <thead>
                        <tr>
                          <th>월</th>
                          <th>갱신일자</th>
                          <th>건수</th>
                          <th>구분</th>
                        </tr>
                      </thead>
                      <tbody>
                        {section.rows.map((item) => (
                          <tr key={`${section.id}-${item.month}`}>
                            <td>{item.month}</td>
                            <td>{formatDateTime(item.updatedAt)}</td>
                            <td>{item.rowCount.toLocaleString()}</td>
                            <td>{item.meta}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </section>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
