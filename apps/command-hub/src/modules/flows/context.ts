import { createContext, useContext } from 'react'

import type { EditorOptions, RunStep } from './types'

/** What a step card needs from the editor: the dropdown lists, edits and the live run. */
export interface EditorContextValue {
  options?: EditorOptions
  setValue: (nodeId: string, field: string, value: string) => void
  setTitle: (nodeId: string, title: string) => void
  stepOf: (nodeId: string) => RunStep | undefined
}

export const EditorContext = createContext<EditorContextValue>({ setValue: () => {}, setTitle: () => {}, stepOf: () => undefined })

export const useEditor = () => useContext(EditorContext)
