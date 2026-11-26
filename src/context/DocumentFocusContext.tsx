import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'

interface DocumentFocusValue {
  focusedMarker: string | undefined
  activeTab: string
  setActiveTab: (tab: string) => void
  focusCitation: (marker: string) => void
  documentsRef: RefObject<HTMLDivElement | null>
}

const DocumentFocusContext = createContext<DocumentFocusValue | undefined>(undefined)

/**
 * Coordinates "click a citation marker on a widget -> switch the Documents
 * widget to its Sources tab and scroll it into view" across the Matter
 * Dashboard page, without threading tab/scroll state through every widget.
 * The Documents widget is always on-page now (not a sheet), so focusing a
 * citation only ever needs to flip its tab and scroll to its ref.
 */
export function DocumentFocusProvider({ children }: { children: ReactNode }) {
  const [focusedMarker, setFocusedMarker] = useState<string>()
  const [activeTab, setActiveTab] = useState('browse')
  const documentsRef = useRef<HTMLDivElement>(null)

  const focusCitation = useCallback((marker: string) => {
    setFocusedMarker(marker)
    setActiveTab('sources')
    documentsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const value = useMemo(
    () => ({ focusedMarker, activeTab, setActiveTab, focusCitation, documentsRef }),
    [focusedMarker, activeTab, focusCitation],
  )

  return <DocumentFocusContext.Provider value={value}>{children}</DocumentFocusContext.Provider>
}

export function useDocumentFocus() {
  const context = useContext(DocumentFocusContext)
  if (!context) {
    throw new Error('useDocumentFocus must be used within a DocumentFocusProvider')
  }
  return context
}
