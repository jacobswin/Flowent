export function formatDecisionOutcomeSummary(outcomes: string[]): string {
  if (outcomes.length === 0) return ''
  return outcomes.join(' · ')
}

export function formatStageConditionSummary(entry: string, exit: string): string {
  const entryText = entry.trim()
  const exitText = exit.trim()
  if (!entryText && !exitText) return ''
  if (entryText && exitText) {
    return `Entry · ${entryText}  →  Exit · ${exitText}`
  }
  return entryText ? `Entry · ${entryText}` : `Exit · ${exitText}`
}

export function truncateSummaryLine(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  return `${text.slice(0, maxChars - 1)}…`
}
