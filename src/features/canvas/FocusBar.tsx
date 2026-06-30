import type { ProcessFocusState } from './focus/processFocus'
import { TopDockPanel } from './TopDockPanel'

interface FocusBarProps {
  focus: ProcessFocusState
  roles: string[]
  onChange: (focus: ProcessFocusState) => void
  defaultCollapsed?: boolean
}

export function FocusBar({ focus, roles, onChange, defaultCollapsed = true }: FocusBarProps) {
  return (
    <TopDockPanel
      className="focus-view-panel"
      ariaLabel="Focus view"
      storageKey="flowent:top-dock:focus-view:collapsed"
      title="Focus view"
      width={330}
      collapsedWidth={190}
      defaultCollapsed={defaultCollapsed}
    >
      <div className="focus-view-controls" role="group" aria-label="Readability focus tools">
        <button type="button" className={focus.mode === 'all' ? 'active' : ''} onClick={() => onChange({ mode: 'all' })}>
          All
        </button>
        <button type="button" className={focus.mode === 'decisions' ? 'active' : ''} onClick={() => onChange({ mode: 'decisions' })}>
          Decision points
        </button>
        <button type="button" className={focus.mode === 'handoffs' ? 'active' : ''} onClick={() => onChange({ mode: 'handoffs' })}>
          Handoff paths
        </button>
        <button type="button" className={focus.mode === 'bottlenecks' ? 'active' : ''} onClick={() => onChange({ mode: 'bottlenecks' })}>
          Bottlenecks
        </button>
        <label htmlFor="focus-role">Role</label>
        <select
          id="focus-role"
          value={focus.mode === 'role' ? focus.role : ''}
          onChange={(event) => {
            if (event.target.value) onChange({ mode: 'role', role: event.target.value })
          }}
        >
          <option value="">Choose role</option>
          {roles.map((role) => (
            <option key={role} value={role}>{role}</option>
          ))}
        </select>
      </div>
    </TopDockPanel>
  )
}
