import { describe, expect, it } from 'vitest'
import { analyzeProcessStages, type ProcessStageInput } from './processIntelligence'

describe('analyzeProcessStages', () => {
  it('calculates cycle metrics and ranks R1, R2, and R3 findings from complete measurements', () => {
    const stages: ProcessStageInput[] = [
      measuredStage('define-scope', 'Define scope', 'value-add', 10, 20),
      measuredStage('wait-review', 'Wait for review', 'wait', 50, 80),
      measuredStage('rework-brief', 'Rework the brief', 'rework', 20, 30),
    ]

    const report = analyzeProcessStages(stages, { profile: 'saas', wip: 8 })

    expect(report.measurementsComplete).toBe(true)
    expect(report.metrics).toMatchObject({
      totalMinutesP50: 80,
      totalMinutesP90: 130,
      valueAddMinutesP50: 10,
      waitMinutesP50: 50,
      reworkMinutesP50: 20,
      processCycleEfficiency: 0.125,
      verdict: 'typical',
      throughputPerHour: 6,
    })
    expect(report.findings.map((finding) => finding.rule)).toEqual(expect.arrayContaining(['R1', 'R2', 'R3']))
    expect(report.findings.find((finding) => finding.rule === 'R1')).toMatchObject({
      nodeIds: ['wait-review'],
      severity: 'high',
    })
  })

  it('reports missing and invalid measurements without producing totals or bottleneck findings', () => {
    const stages: ProcessStageInput[] = [
      measuredStage('define-scope', 'Define scope', 'value-add', 10, 20),
      { nodeId: 'wait-review', title: 'Wait for review', kind: 'wait', durationMinutesP50: 50 },
      measuredStage('rework-brief', 'Rework the brief', 'rework', 20, 10),
    ]

    const report = analyzeProcessStages(stages, { profile: 'manufacturing' })

    expect(report.measurementsComplete).toBe(false)
    expect(report.metrics).toBeNull()
    expect(report.findings).toEqual([])
    expect(report.dataGaps).toEqual(expect.arrayContaining([
      expect.objectContaining({ nodeId: 'wait-review', field: 'durationMinutesP90' }),
      expect.objectContaining({ nodeId: 'rework-brief', field: 'durationOrder' }),
    ]))
  })

  it('uses the selected industry baseline when classifying waits and rework', () => {
    const stages: ProcessStageInput[] = [
      measuredStage('design', 'Design', 'value-add', 50, 70),
      measuredStage('wait-test', 'Wait for validation', 'wait', 35, 45),
      measuredStage('rework-test', 'Rework prototype', 'rework', 10, 15),
    ]

    const automotive = analyzeProcessStages(stages, { profile: 'automotive' })
    const engineering = analyzeProcessStages(stages, { profile: 'engineering' })

    expect(automotive.findings.map((finding) => finding.rule)).toEqual(expect.arrayContaining(['R2', 'R3']))
    expect(engineering.findings.map((finding) => finding.rule)).not.toEqual(expect.arrayContaining(['R2', 'R3']))
  })
})

function measuredStage(
  nodeId: string,
  title: string,
  kind: ProcessStageInput['kind'],
  durationMinutesP50: number,
  durationMinutesP90: number,
): ProcessStageInput {
  return { nodeId, title, kind, durationMinutesP50, durationMinutesP90 }
}
