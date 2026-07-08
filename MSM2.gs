// ============================================================
// MSM2.gs - Monthly strategy sheet -> frontend JSON
// ============================================================
// Rule
// - GAS only reads Google Sheets and returns JSON.
// - Frontend writes/merges the payload to Firebase.
//
// Firebase shape
// monthlyStrategy/{YYYYMM}/teams/{teamKey}/strategy
// monthlyStrategy/{YYYYMM}/teams/{teamKey}/plans
//
// Managed fields
// - month: selected month, YYYYMM
// - teams.{teamKey}.strategy.currentText: selected-month strategy, D6
// - teams.{teamKey}.strategy.currentRichText: selected-month rich text/style, D6
// - teams.{teamKey}.strategy.nextText: next-month strategy, G6
// - teams.{teamKey}.strategy.nextRichText: next-month rich text/style, G6
// - teams.{teamKey}.plans: request rows, B54:Q
//
// Request row mapping, B:Q
// - B no
// - C team
// - D mdCategory
// - E requestDate
// - F requestTime
// - G weightedMin
// - H programCodeName        required, non-empty rows only
// - I newProductType
// - J dealType
// - K price
// - L composition
// - M marginRate
// - N perMinuteFixedCost
// - O perMinuteRevenue
// - P perMinuteProfit
// - Q remark
//
// Excluded
// - Weekly/calendar blocks are not stored.
// - Frontend calculates calendar rendering from plans[].requestDate.
// ============================================================

const MSM2 = {
  spreadsheetId: '1pNmxVwV6Qn-_6fZlXUtrtH5Q4Apw9R-A26M0KOdS6wA',
  firebasePath: 'monthlyStrategy',
  timeZone: 'Asia/Seoul',
  yearCell: 'B1',
  monthCell: 'B2',
  currentStrategyCell: 'D6',
  nextStrategyCell: 'G6',
  planStartRow: 54,
  planStartCol: 2, // B
  planColCount: 16, // B:Q
  planRequiredCol: 8, // H
  teams: [
    { sheetNames: ['\ubdf0\ud2f0'], teamKey: 'beauty', teamName: '\ubdf0\ud2f0' },
    { sheetNames: ['\ub9ac\uc2dd\ud488', '\uc2dd\ud488'], teamKey: 'food', teamName: '\uc2dd\ud488' },
    { sheetNames: ['\ub9ac\ube59'], teamKey: 'living', teamName: '\ub9ac\ube59' },
    { sheetNames: ['\ud5ec\uc2a4\ud478\ub4dc'], teamKey: 'healthFood', teamName: '\ud5ec\uc2a4\ud478\ub4dc' },
    { sheetNames: ['\ud328\uc158\ud2b8\ub80c\ub4dc'], teamKey: 'fashionTrend', teamName: '\ud328\uc158\ud2b8\ub80c\ub4dc' },
    { sheetNames: ['\ubb38\ud654/\uc11c\ube44\uc2a4', '\ubb38\ud654\uc11c\ube44\uc2a4'], teamKey: 'cultureService', teamName: '\ubb38\ud654/\uc11c\ube44\uc2a4' },
    { sheetNames: ['\uac00\uc804'], teamKey: 'appliance', teamName: '\uac00\uc804' },
  ],
}

function doGet(e) {
  try {
    const month = msm2NormalizeMonth_(e && e.parameter && e.parameter.month)
    const payload = msm2BuildStrategyPayload_(month)

    return msm2Json_(e, {
      ok: true,
      payload,
      firebasePath: `${MSM2.firebasePath}/${payload.month}`,
      updatedAt: payload.updatedAt,
    })
  } catch (error) {
    return msm2Json_(e, {
      ok: false,
      error: error.message,
    })
  }
}

function msm2BuildStrategyPayload_(requestedMonth) {
  const ss = SpreadsheetApp.openById(MSM2.spreadsheetId)
  const teams = {}
  let month = requestedMonth

  MSM2.teams.forEach(team => {
    const sheet = msm2FindSheet_(ss, team.sheetNames)
    if (!sheet) return

    const sheetMonth = msm2GetSheetMonth_(sheet)
    if (!month) month = sheetMonth

    const teamMonth = month || sheetMonth
    teams[team.teamKey] = msm2ReadTeam_(sheet, team, teamMonth, sheetMonth)
  })

  if (!month) throw new Error('month parameter required, ex) 202608')

  return {
    month,
    updatedAt: new Date().toISOString(),
    teams,
  }
}

function msm2ReadTeam_(sheet, team, month, sheetMonth) {
  const plans = msm2ReadPlans_(sheet, month)

  return {
    sheetName: sheet.getName(),
    teamKey: team.teamKey,
    teamName: team.teamName,
    strategy: {
      currentMonth: sheetMonth || month,
      currentText: msm2CellText_(sheet, MSM2.currentStrategyCell),
      currentRichText: msm2RichCell_(sheet, MSM2.currentStrategyCell),
      nextMonth: msm2AddMonth_(sheetMonth || month, 1),
      nextText: msm2CellText_(sheet, MSM2.nextStrategyCell),
      nextRichText: msm2RichCell_(sheet, MSM2.nextStrategyCell),
    },
    plans,
    summary: msm2Summarize_(plans),
  }
}

function msm2ReadPlans_(sheet, month) {
  const lastRow = msm2FindLastPlanRow_(sheet)
  if (lastRow < MSM2.planStartRow) return []

  const rowCount = lastRow - MSM2.planStartRow + 1
  const range = sheet.getRange(MSM2.planStartRow, MSM2.planStartCol, rowCount, MSM2.planColCount)
  const values = range.getValues()
  const texts = range.getDisplayValues()
  const plans = []

  values.forEach((row, i) => {
    const text = texts[i]
    const programCodeName = msm2Clean_(text[6])
    if (!programCodeName) return

    const requestDate = msm2Date_(row[3], text[3], month)
    if (requestDate && msm2Yyyymm_(requestDate) !== month) return

    const weightedMin = msm2Num_(row[5])
    const perMinuteRevenue = msm2Num_(row[13])
    const perMinuteProfit = msm2Num_(row[14])

    plans.push({
      sourceRow: MSM2.planStartRow + i,
      no: msm2NumOrText_(row[0], text[0]),
      team: msm2Clean_(text[1]),
      mdCategory: msm2Clean_(text[2]),
      requestDate,
      requestTime: msm2Time_(row[4], text[4]),
      weightedMin,
      programCodeName,
      newProductType: msm2Clean_(text[7]),
      dealType: msm2Clean_(text[8]),
      price: msm2Num_(row[9]),
      composition: msm2Clean_(text[10]),
      marginRate: msm2Num_(row[11]),
      perMinuteFixedCost: msm2Num_(row[12]),
      perMinuteRevenue,
      perMinuteProfit,
      expectedRevenue: perMinuteRevenue * weightedMin * 10000,
      expectedProfit: perMinuteProfit * weightedMin * 10000,
      remark: msm2Clean_(text[15]),
    })
  })

  return plans
}

function msm2FindLastPlanRow_(sheet) {
  const sheetLastRow = sheet.getLastRow()
  if (sheetLastRow < MSM2.planStartRow) return 0

  const rowCount = sheetLastRow - MSM2.planStartRow + 1
  const values = sheet
    .getRange(MSM2.planStartRow, MSM2.planRequiredCol, rowCount, 1)
    .getDisplayValues()

  for (let i = values.length - 1; i >= 0; i -= 1) {
    if (msm2Clean_(values[i][0])) return MSM2.planStartRow + i
  }

  return 0
}

function msm2Summarize_(plans) {
  return plans.reduce((acc, plan) => {
    acc.planCount += 1
    acc.weightedMin += plan.weightedMin
    acc.expectedRevenue += plan.expectedRevenue
    acc.expectedProfit += plan.expectedProfit
    return acc
  }, {
    planCount: 0,
    weightedMin: 0,
    expectedRevenue: 0,
    expectedProfit: 0,
  })
}

function msm2FindSheet_(ss, sheetNames) {
  for (const name of sheetNames) {
    const sheet = ss.getSheetByName(name)
    if (sheet) return sheet
  }
  return null
}

function msm2GetSheetMonth_(sheet) {
  const year = msm2Num_(sheet.getRange(MSM2.yearCell).getValue())
  const month = msm2Num_(sheet.getRange(MSM2.monthCell).getValue())
  return year && month ? `${year}${msm2Pad2_(month)}` : ''
}

function msm2CellText_(sheet, a1) {
  return msm2Clean_(sheet.getRange(a1).getDisplayValue())
}

function msm2RichCell_(sheet, a1) {
  const range = sheet.getRange(a1)
  const text = range.getDisplayValue()
  const richText = range.getRichTextValue()
  const runs = richText ? richText.getRuns() : []

  if (!text) {
    return {
      text: '',
      runs: [],
    }
  }

  if (!richText || runs.length === 0) {
    return {
      text,
      runs: [msm2StyleRun_(text, range.getTextStyle(), range.getTextStyle())],
    }
  }

  return {
    text,
    runs: runs.map(run => msm2StyleRun_(run.getText(), run.getTextStyle(), range.getTextStyle())),
  }
}

function msm2StyleRun_(text, style, fallbackStyle) {
  const activeStyle = style || fallbackStyle

  return {
    text: String(text || ''),
    bold: activeStyle ? activeStyle.isBold() : false,
    italic: activeStyle ? activeStyle.isItalic() : false,
    underline: activeStyle ? activeStyle.isUnderline() : false,
    strikethrough: activeStyle && typeof activeStyle.isStrikethrough === 'function'
      ? activeStyle.isStrikethrough()
      : false,
    fontSize: activeStyle ? activeStyle.getFontSize() : null,
    fontFamily: activeStyle ? activeStyle.getFontFamily() : '',
    foregroundColor: activeStyle ? activeStyle.getForegroundColor() : '',
  }
}

function msm2NormalizeMonth_(value) {
  const text = msm2Clean_(value)
  if (!text) return ''

  const matched = text.match(/^(\d{4})[-/.]?(\d{1,2})$/)
  if (!matched) throw new Error('month must be YYYYMM')

  return `${matched[1]}${msm2Pad2_(matched[2])}`
}

function msm2Date_(value, display, fallbackMonth) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, MSM2.timeZone, 'yyyy-MM-dd')
  }

  const text = msm2Clean_(display || value).replace(/[.]/g, '-').replace(/\//g, '-')
  let matched = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (matched) return `${matched[1]}-${msm2Pad2_(matched[2])}-${msm2Pad2_(matched[3])}`

  matched = text.match(/^(\d{1,2})-(\d{1,2})$/)
  if (matched && fallbackMonth) {
    return `${fallbackMonth.slice(0, 4)}-${msm2Pad2_(matched[1])}-${msm2Pad2_(matched[2])}`
  }

  matched = text.match(/^(\d{1,2})$/)
  if (matched && fallbackMonth) {
    return `${fallbackMonth.slice(0, 4)}-${fallbackMonth.slice(4, 6)}-${msm2Pad2_(matched[1])}`
  }

  return ''
}

function msm2Time_(value, display) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, MSM2.timeZone, 'HH:mm')
  }

  if (typeof value === 'number' && value >= 0 && value < 1) {
    const minutes = Math.round(value * 24 * 60)
    return `${msm2Pad2_(Math.floor(minutes / 60))}:${msm2Pad2_(minutes % 60)}`
  }

  const text = msm2Clean_(display || value)
  const matched = text.match(/(\d{1,2})\s*[:시]\s*(\d{1,2})?/)
  return matched ? `${msm2Pad2_(matched[1])}:${msm2Pad2_(matched[2] || 0)}` : text
}

function msm2Num_(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0

  const num = Number(msm2Clean_(value).replace(/,/g, '').replace(/%/g, ''))
  return Number.isFinite(num) ? num : 0
}

function msm2NumOrText_(value, display) {
  const num = msm2Num_(value)
  return num || msm2Clean_(display) === '0' ? num : msm2Clean_(display)
}

function msm2Yyyymm_(dateText) {
  const matched = String(dateText || '').match(/^(\d{4})-(\d{2})-/)
  return matched ? `${matched[1]}${matched[2]}` : ''
}

function msm2AddMonth_(month, amount) {
  const date = new Date(Number(month.slice(0, 4)), Number(month.slice(4, 6)) - 1 + amount, 1)
  return `${date.getFullYear()}${msm2Pad2_(date.getMonth() + 1)}`
}

function msm2Clean_(value) {
  return String(value || '').trim()
}

function msm2Pad2_(value) {
  return String(Number(value)).padStart(2, '0')
}

function msm2Json_(e, obj) {
  const json = JSON.stringify(obj)
  const callback = e && e.parameter && e.parameter.callback

  if (callback) {
    if (!/^[A-Za-z_$][0-9A-Za-z_$]*(\.[A-Za-z_$][0-9A-Za-z_$]*)*$/.test(callback)) {
      return ContentService
        .createTextOutput('/* invalid callback */')
        .setMimeType(ContentService.MimeType.JAVASCRIPT)
    }

    return ContentService
      .createTextOutput(`${callback}(${json});`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT)
  }

  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON)
}
