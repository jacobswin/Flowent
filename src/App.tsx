import type { KeyboardEvent } from 'react'
import { useState } from 'react'
import { MultiRoleProcessViews } from './features/process-views/MultiRoleProcessViews'
import { RoleNavigation } from './features/role-navigation/RoleNavigation'
import { ScenarioGeneration } from './features/scenario-generation/ScenarioGeneration'

type AppMode = 'role-navigation' | 'process-views' | 'scenario-generation'

const APP_MODES: AppMode[] = ['role-navigation', 'process-views', 'scenario-generation']

export default function App() {
  const [selectedMode, setSelectedMode] = useState<AppMode>('role-navigation')
  const [selectedRoleId, setSelectedRoleId] = useState('frontend-engineer')

  function selectMode(mode: AppMode, shouldFocus = false): void {
    setSelectedMode(mode)

    if (shouldFocus) {
      document.getElementById(`${mode}-tab`)?.focus()
    }
  }

  function handleModeKeyDown(event: KeyboardEvent<HTMLButtonElement>, mode: AppMode): void {
    const currentIndex = APP_MODES.indexOf(mode)
    const lastIndex = APP_MODES.length - 1
    const nextModeByKey: Partial<Record<string, AppMode>> = {
      ArrowRight: APP_MODES[currentIndex === lastIndex ? 0 : currentIndex + 1],
      ArrowDown: APP_MODES[currentIndex === lastIndex ? 0 : currentIndex + 1],
      ArrowLeft: APP_MODES[currentIndex === 0 ? lastIndex : currentIndex - 1],
      ArrowUp: APP_MODES[currentIndex === 0 ? lastIndex : currentIndex - 1],
      Home: APP_MODES[0],
      End: APP_MODES[lastIndex],
    }
    const nextMode = nextModeByKey[event.key]

    if (!nextMode) {
      return
    }

    event.preventDefault()
    selectMode(nextMode, true)
  }

  return (
    <>
      <nav className="app-mode-switcher" aria-label="Flowent prototype sections" role="tablist">
        <button
          id="role-navigation-tab"
          type="button"
          role="tab"
          aria-selected={selectedMode === 'role-navigation'}
          aria-controls="role-navigation-panel"
          tabIndex={selectedMode === 'role-navigation' ? 0 : -1}
          onClick={() => selectMode('role-navigation')}
          onKeyDown={(event) => handleModeKeyDown(event, 'role-navigation')}
        >
          Role navigation
        </button>
        <button
          id="process-views-tab"
          type="button"
          role="tab"
          aria-selected={selectedMode === 'process-views'}
          aria-controls="process-views-panel"
          tabIndex={selectedMode === 'process-views' ? 0 : -1}
          onClick={() => selectMode('process-views')}
          onKeyDown={(event) => handleModeKeyDown(event, 'process-views')}
        >
          Process views
        </button>
        <button
          id="scenario-generation-tab"
          type="button"
          role="tab"
          aria-selected={selectedMode === 'scenario-generation'}
          aria-controls="scenario-generation-panel"
          tabIndex={selectedMode === 'scenario-generation' ? 0 : -1}
          onClick={() => selectMode('scenario-generation')}
          onKeyDown={(event) => handleModeKeyDown(event, 'scenario-generation')}
        >
          Scenario generation
        </button>
      </nav>
      <section
        id="role-navigation-panel"
        role="tabpanel"
        aria-labelledby="role-navigation-tab"
        hidden={selectedMode !== 'role-navigation'}
      >
        <RoleNavigation selectedRoleId={selectedRoleId} onRoleChange={setSelectedRoleId} />
      </section>
      <section
        id="process-views-panel"
        role="tabpanel"
        aria-labelledby="process-views-tab"
        hidden={selectedMode !== 'process-views'}
      >
        <MultiRoleProcessViews />
      </section>
      <section
        id="scenario-generation-panel"
        role="tabpanel"
        aria-labelledby="scenario-generation-tab"
        hidden={selectedMode !== 'scenario-generation'}
      >
        <ScenarioGeneration />
      </section>
    </>
  )
}
