import { useEffect, useState } from 'react'

interface State<T> {
  data: T | null
  error: string | null
  loading: boolean
}

/** Runs `fn` whenever `key` changes; cancels the in-flight request on change/unmount. */
export function useFetch<T>(fn: (signal: AbortSignal) => Promise<T>, key: string): State<T> {
  const [state, setState] = useState<State<T>>({ data: null, error: null, loading: true })

  useEffect(() => {
    const ctrl = new AbortController()
    setState((s) => ({ ...s, error: null, loading: true }))
    fn(ctrl.signal)
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return
        setState((s) => ({ ...s, error: e instanceof Error ? e.message : 'Unknown error', loading: false }))
      })
    return () => ctrl.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` encodes everything fn depends on
  }, [key])

  return state
}
