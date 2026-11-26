import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

interface DocumentFocusValue {
  focusedMarker: string | undefined
  focusCitation: (marker: string) => void
}

const DocumentFocusContext = createContext<DocumentFocusValue | undefined>(undefined)

/**
 * Coordinates "click a citation marker on a widget -> open/scroll the
 * Documents panel to the matching source" across the Matter Dashboard page,
 * without threading the Documents panel's open/scroll state through every
 * widget. `onFocus` is how the page itself reacts (e.g. opening the panel
 * sheet); the Sources tab reads `focusedMarker` directly to decide what to
 * highlight.
 */
export function DocumentFocusProvider({ children, onFocus }: { children: ReactNode; onFocus: (marker: string) => void }) {
  const [focusedMarker, setFocusedMarker] = useState<string>()

  const focusCitation = useCallback(
    (marker: string) => {
      setFocusedMarker(marker)
      onFocus(marker)
    },
    [onFocus],
  )

  const value = useMemo(() => ({ focusedMarker, focusCitation }), [focusedMarker, focusCitation])

  return <DocumentFocusContext.Provider value={value}>{children}</DocumentFocusContext.Provider>
}

export function useDocumentFocus() {
  const context = useContext(DocumentFocusContext)
  if (!context) {
    throw new Error('useDocumentFocus must be used within a DocumentFocusProvider')
  }
  return context
}
