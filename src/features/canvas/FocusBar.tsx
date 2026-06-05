import type { ProcessFocusState } from './focus/processFocus'

interface FocusBarProps {
  focus: ProcessFocusState
  roles: string[]
  onChange: (focus: ProcessFocusState) => void
}

export function FocusBar({ focus, roles, onChange }: FocusBarProps) {
  return (
    <section className="focus-bar" aria-label="Readability focus tools">
      <button type="button" className={focus.mode === 'all' ? 'active' : ''} onClick={() => onChange({ mode: 'all' })}>
        All
      </button>
      <button type="button" className={focus.mode === 'decisions' ? 'active' : ''} onClick={() => onChange({ mode: 'decisions' })}>
        Decisions
      </button>
      <button type="button" className={focus.mode === 'handoffs' ? 'active' : ''} onClick={() => onChange({ mode: 'handoffs' })}>
        Handoffs
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
    </section>
  )
}
