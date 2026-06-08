import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'

/**
 * A small wrapper around useState that re-syncs the local draft
 * whenever the external value diverges from the last external value
 * the hook saw. This lets users type freely without losing their
 * in-progress edit, while still keeping the editor in sync when an
 * undo or external mutation actually changes the underlying value.
 *
 * The optional `serialize` lets callers compare structured values by
 * a stable string (e.g. JSON) when `===` is not enough.
 */
export function useDraft<T>(
  value: T,
  serialize: (input: T) => string = (input) => String(input),
): readonly [T, Dispatch<SetStateAction<T>>] {
  const [draft, setDraft] = useState<T>(value)
  const [lastExternal, setLastExternal] = useState<string>(serialize(value))

  // We intentionally depend only on the serialized value: when the
  // user is mid-edit we don't want this effect to clobber their
  // local draft with the same value. The setState-in-effect pattern
  // is the documented sync between external value and local draft.
  /* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */
  useEffect(() => {
    const serialized = serialize(value)
    if (serialized !== lastExternal) {
      setDraft(value)
      setLastExternal(serialized)
    }
  }, [serialize(value)])
  /* eslint-enable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */

  return [draft, setDraft] as const
}
