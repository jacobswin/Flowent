import { useCallback, useEffect, useRef, useState } from 'react'
import type { Activity, Approval, Confirmation, Decision, DraftState, Expectation, Handoff, ProcessInput, ProcessMap, ProcessOutput, ProcessMapVersion, Role, WorkProduct } from './types'
import type { GeneratedSource } from '../scenario-generation/types'
import {
  activateMap,
  approveMap,
  computeImpactAnalysis,
  confirmForRole as confirmForRoleOp,
  createVersionSnapshot,
  markReadyForConfirmation,
  rejectMap,
  removeConfirmation as removeConfirmationOp,
} from './consensusOperations'
import {
  addActivity as addActivityOp,
  addDecision as addDecisionOp,
  addExpectation as addExpectationOp,
  addHandoff as addHandoffOp,
  addInput as addInputOp,
  addOutput as addOutputOp,
  addRole as addRoleOp,
  addWorkProduct as addWorkProductOp,
  computeReadiness,
  removeActivity as removeActivityOp,
  removeDecision as removeDecisionOp,
  removeExpectation as removeExpectationOp,
  removeHandoff as removeHandoffOp,
  removeInput as removeInputOp,
  removeOutput as removeOutputOp,
  removeRole as removeRoleOp,
  removeWorkProduct as removeWorkProductOp,
  updateActivity as updateActivityOp,
  updateDecision as updateDecisionOp,
  updateHandoff as updateHandoffOp,
  updateMapScenario,
  updateMapTitle,
  type ReadinessStatus,
  type WorkspaceResult,
} from './workspaceOperations'

const MAX_HISTORY = 50

interface WorkspaceSnapshot {
  map: ProcessMap
  sources: Record<string, GeneratedSource>
}

interface WorkspaceState {
  map: ProcessMap
  sources: Record<string, GeneratedSource>
  history: WorkspaceSnapshot[]
  future: WorkspaceSnapshot[]
  initialTitle: string
  dirty: boolean
  draftState: DraftState
  confirmations: Confirmation[]
  approval: Approval | null
  versions: ProcessMapVersion[]
}

export interface WorkspaceApi {
  map: ProcessMap
  sources: Record<string, GeneratedSource>
  isDirty: boolean
  canUndo: boolean
  canRedo: boolean
  readiness: ReadinessStatus
  undo: () => void
  redo: () => void
  updateTitle: (title: string) => void
  updateScenario: (scenario: string) => void
  addActivity: (activity: Activity) => void
  removeActivity: (activityId: string) => void
  updateActivity: (activityId: string, updates: Partial<Pick<Activity, 'title' | 'summary' | 'responsibilities' | 'inputIds' | 'outputIds' | 'decisionIds' | 'handoffIds' | 'expectationIds' | 'workProductIds'>>) => void
  addDecision: (decision: Decision) => void
  removeDecision: (decisionId: string) => void
  updateDecision: (decisionId: string, updates: Partial<Pick<Decision, 'title' | 'affectedActorIds' | 'criteria'>>) => void
  addHandoff: (handoff: Handoff) => void
  removeHandoff: (handoffId: string) => void
  updateHandoff: (handoffId: string, updates: Partial<Pick<Handoff, 'title' | 'fromActorIds' | 'toActorIds' | 'inputIds' | 'outputIds' | 'expectationIds'>>) => void
  addRole: (role: Role) => void
  removeRole: (roleId: string) => void
  addInput: (input: ProcessInput) => void
  removeInput: (inputId: string) => void
  addOutput: (output: ProcessOutput) => void
  removeOutput: (outputId: string) => void
  addExpectation: (expectation: Expectation) => void
  removeExpectation: (expectationId: string) => void
  addWorkProduct: (workProduct: WorkProduct) => void
  removeWorkProduct: (workProductId: string) => void
  draftState: DraftState
  confirmations: Confirmation[]
  approval: Approval | null
  versions: ProcessMapVersion[]
  confirmForRole: (actorId: string, actorName: string, actorKind: 'role' | 'stakeholder' | 'upstream' | 'downstream') => void
  removeConfirmation: (actorId: string) => void
  markReady: () => void
  approve: (approverName: string, comment?: string) => void
  reject: (approverName: string, comment?: string) => void
  activate: () => void
}

export function useWorkspace(initialMap: ProcessMap, initialSources: Record<string, GeneratedSource> = {}): WorkspaceApi {
  const [state, setState] = useState<WorkspaceState>({
    map: initialMap,
    sources: initialSources,
    history: [],
    future: [],
    initialTitle: initialTitle(initialMap),
    dirty: false,
    draftState: 'draft',
    confirmations: [],
    approval: null,
    versions: [],
  })

  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  const pushSnapshot = useCallback((result: WorkspaceResult) => {
    setState((current) => {
      const snapshot: WorkspaceSnapshot = { map: current.map, sources: current.sources }
      const history = [...current.history, snapshot].slice(-MAX_HISTORY)

      return {
        ...current,
        map: result.map,
        sources: result.sources,
        history,
        future: [],
        dirty: true,
      }
    })
  }, [])

  const pushMapOnly = useCallback((map: ProcessMap) => {
    setState((current) => {
      const snapshot: WorkspaceSnapshot = { map: current.map, sources: current.sources }
      const history = [...current.history, snapshot].slice(-MAX_HISTORY)

      return { ...current, map, history, future: [], dirty: true }
    })
  }, [])

  const undo = useCallback(() => {
    setState((current) => {
      if (current.history.length === 0) return current

      const previous = current.history[current.history.length - 1]
      const future: WorkspaceSnapshot = { map: current.map, sources: current.sources }

      return {
        ...current,
        map: previous.map,
        sources: previous.sources,
        history: current.history.slice(0, -1),
        future: [...current.future, future],
      }
    })
  }, [])

  const redo = useCallback(() => {
    setState((current) => {
      if (current.future.length === 0) return current

      const next = current.future[current.future.length - 1]
      const snapshot: WorkspaceSnapshot = { map: current.map, sources: current.sources }

      return {
        ...current,
        map: next.map,
        sources: next.sources,
        history: [...current.history, snapshot],
        future: current.future.slice(0, -1),
      }
    })
  }, [])

  const wrapOp = useCallback(
    (op: (map: ProcessMap, sources: Record<string, GeneratedSource>, ...args: never[]) => WorkspaceResult) =>
      (...args: never[]) => {
        const current = stateRef.current
        pushSnapshot(op(current.map, current.sources, ...args))
      },
    [pushSnapshot],
  )

  return {
    map: state.map,
    sources: state.sources,
    isDirty: state.dirty,
    canUndo: state.history.length > 0,
    canRedo: state.future.length > 0,
    readiness: computeReadiness(state.map),
    undo,
    redo,
    updateTitle: useCallback((title: string) => pushMapOnly(updateMapTitle(stateRef.current.map, title)), [pushMapOnly]),
    updateScenario: useCallback((scenario: string) => pushMapOnly(updateMapScenario(stateRef.current.map, scenario)), [pushMapOnly]),
    addActivity: wrapOp(addActivityOp) as (activity: Activity) => void,
    removeActivity: wrapOp(removeActivityOp) as (activityId: string) => void,
    updateActivity: wrapOp(updateActivityOp) as WorkspaceApi['updateActivity'],
    addDecision: wrapOp(addDecisionOp) as (decision: Decision) => void,
    removeDecision: wrapOp(removeDecisionOp) as (decisionId: string) => void,
    updateDecision: wrapOp(updateDecisionOp) as WorkspaceApi['updateDecision'],
    addHandoff: wrapOp(addHandoffOp) as (handoff: Handoff) => void,
    removeHandoff: wrapOp(removeHandoffOp) as (handoffId: string) => void,
    updateHandoff: wrapOp(updateHandoffOp) as WorkspaceApi['updateHandoff'],
    addRole: wrapOp(addRoleOp) as (role: Role) => void,
    removeRole: wrapOp(removeRoleOp) as (roleId: string) => void,
    addInput: wrapOp(addInputOp) as (input: ProcessInput) => void,
    removeInput: wrapOp(removeInputOp) as (inputId: string) => void,
    addOutput: wrapOp(addOutputOp) as (output: ProcessOutput) => void,
    removeOutput: wrapOp(removeOutputOp) as (outputId: string) => void,
    addExpectation: wrapOp(addExpectationOp) as (expectation: Expectation) => void,
    removeExpectation: wrapOp(removeExpectationOp) as (expectationId: string) => void,
    addWorkProduct: wrapOp(addWorkProductOp) as (workProduct: WorkProduct) => void,
    removeWorkProduct: wrapOp(removeWorkProductOp) as (workProductId: string) => void,
    draftState: state.draftState,
    confirmations: state.confirmations,
    approval: state.approval,
    versions: state.versions,
    confirmForRole: useCallback((actorId: string, actorName: string, actorKind: 'role' | 'stakeholder' | 'upstream' | 'downstream') => {
      setState((current) => {
        const result = confirmForRoleOp(current.map, current.confirmations, actorId, actorName, actorKind)
        return { ...current, confirmations: result.confirmations }
      })
    }, []),
    removeConfirmation: useCallback((actorId: string) => {
      setState((current) => ({
        ...current,
        confirmations: removeConfirmationOp(current.confirmations, actorId),
      }))
    }, []),
    markReady: useCallback(() => {
      setState((current) => {
        const result = markReadyForConfirmation(current.map, current.draftState)
        return { ...current, draftState: result.draftState }
      })
    }, []),
    approve: useCallback((approverName: string, comment?: string) => {
      setState((current) => {
        const result = approveMap(current.map, approverName, comment)
        return { ...current, approval: result.approval, draftState: 'approved' }
      })
    }, []),
    reject: useCallback((approverName: string, comment?: string) => {
      setState((current) => {
        const result = rejectMap(current.map, approverName, comment)
        return { ...current, approval: result.approval, draftState: 'rejected' }
      })
    }, []),
    activate: useCallback(() => {
      setState((current) => {
        if (!current.approval || current.approval.state !== 'approved') return current

        const impact = computeImpactAnalysis(current.map, null)
        impact.confirmedBy = current.confirmations.map((c) => c.actorName)
        const activatedMap = activateMap(current.map)
        const version = createVersionSnapshot(activatedMap, current.confirmations, current.approval, impact)

        return {
          ...current,
          map: activatedMap,
          draftState: 'activated',
          versions: [...current.versions, version],
          history: [...current.history, { map: current.map, sources: current.sources }].slice(-MAX_HISTORY),
          future: [],
          dirty: true,
        }
      })
    }, []),
  }
}

function initialTitle(map: ProcessMap): string {
  return map.title
}
