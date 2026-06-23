import { useMemo, useState } from 'react'
import './PrintTeamModal.css'

const TEAMS = [
  { key: 'beauty', label: '뷰티' },
  { key: 'food', label: '식품' },
  { key: 'living', label: '리빙' },
  { key: 'healthFood', label: '헬스푸드' },
  { key: 'fashionTrend', label: '패션트렌드' },
  { key: 'cultureService', label: '문화/서비스' },
  { key: 'appliance', label: '가전' },
]

export default function PrintTeamModal({ onClose, onExport }) {
  const allTeamKeys = useMemo(() => TEAMS.map((team) => team.key), [])
  const [selectedTeamKeys, setSelectedTeamKeys] = useState(allTeamKeys)
  const isAllSelected = selectedTeamKeys.length === TEAMS.length

  const toggleTeam = (teamKey) => {
    setSelectedTeamKeys((current) =>
      current.includes(teamKey)
        ? current.filter((key) => key !== teamKey)
        : [...current, teamKey],
    )
  }

  const toggleAll = () => {
    setSelectedTeamKeys(isAllSelected ? [] : allTeamKeys)
  }

  return (
    <section className="print-team-modal" aria-modal="true" role="dialog">
      <div className="print-team-card">
        <div className="print-team-header">
          <div>
            <h2>인쇄/PDF</h2>
            <p>출력할 조직을 선택하세요.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>

        <label className="print-team-all">
          <input type="checkbox" checked={isAllSelected} onChange={toggleAll} />
          <span>전체 선택</span>
        </label>

        <div className="print-team-list">
          {TEAMS.map((team) => (
            <label className="print-team-option" key={team.key}>
              <input
                type="checkbox"
                checked={selectedTeamKeys.includes(team.key)}
                onChange={() => toggleTeam(team.key)}
              />
              <span>{team.label}</span>
            </label>
          ))}
        </div>

        <div className="print-team-actions">
          <button type="button" onClick={onClose}>
            취소
          </button>
          <button
            className="is-primary"
            type="button"
            disabled={selectedTeamKeys.length === 0}
            onClick={() => onExport(selectedTeamKeys)}
          >
            인쇄/PDF
          </button>
        </div>
      </div>
    </section>
  )
}
