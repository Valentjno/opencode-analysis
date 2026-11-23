import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Layout, type Route } from './components/Layout'
import { ModelDetail } from './components/ModelDetail'
import { StaleBanner } from './components/StaleBanner'
import { CatalogView } from './views/CatalogView'
import { isStale, loadChanges, loadResearch, loadSnapshot, modelById } from './lib/data'
import { useTheme } from './lib/theme'
import type { ChangeFeed, ResearchFeed, Snapshot } from './lib/types'

const ValueView = lazy(() =>
  import('./views/ValueView').then((module) => ({ default: module.ValueView })),
)
const ChangesView = lazy(() =>
  import('./views/ChangesView').then((module) => ({ default: module.ChangesView })),
)
const MethodologyView = lazy(() =>
  import('./views/MethodologyView').then((module) => ({ default: module.MethodologyView })),
)

const ROUTES: Route[] = ['catalog', 'value', 'changes', 'about']

interface ParsedHash {
  route: Route
  modelId: string | null
}

function parseHash(hash: string): ParsedHash {
  const raw = hash.replace(/^#/, '')
  const [first, second] = raw.split('/')
  if (first === 'model' && second) {
    return { route: 'catalog', modelId: decodeURIComponent(second) }
  }
  if (first.startsWith('model=')) {
    return { route: 'catalog', modelId: decodeURIComponent(first.slice('model='.length)) }
  }
  if (ROUTES.includes(first as Route)) {
    return {
      route: first as Route,
      modelId: second?.startsWith('model=')
        ? decodeURIComponent(second.slice('model='.length))
        : null,
    }
  }
  return { route: 'catalog', modelId: null }
}

function currentHash(): string {
  return typeof window === 'undefined' ? '' : window.location.hash
}

export default function App() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [changes, setChanges] = useState<ChangeFeed | null>(null)
  const [research, setResearch] = useState<ResearchFeed | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hash, setHash] = useState(currentHash)
  const previousRoute = useRef<Route>('catalog')
  const { choice, choose } = useTheme()

  useEffect(() => {
    let active = true
    Promise.all([loadSnapshot(), loadChanges(), loadResearch()])
      .then(([data, feed, external]) => {
        if (!active) return
        setSnapshot(data)
        setChanges(feed)
        setResearch(external)
      })
      .catch((cause: unknown) => {
        if (!active) return
        setError(cause instanceof Error ? cause.message : 'Could not load the dataset.')
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const onHashChange = () => setHash(currentHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const parsed = parseHash(hash)
  const route = parsed.route
  const selected = snapshot ? modelById(snapshot.models, parsed.modelId) : null

  useEffect(() => {
    if (!parsed.modelId) window.scrollTo({ top: 0, behavior: 'auto' })
  }, [route, parsed.modelId])

  useEffect(() => {
    if (parsed.modelId && route !== 'catalog') previousRoute.current = route
  }, [parsed.modelId, route])

  const openModel = useCallback((id: string) => {
    if (route !== 'catalog') previousRoute.current = route
    window.location.hash = `#catalog/model=${encodeURIComponent(id)}`
  }, [route])

  const closeModel = useCallback(() => {
    window.location.hash = `#${previousRoute.current}`
  }, [])

  const content = () => {
    if (error) {
      return (
        <div className="section">
          <div className="empty-state">
            <div>
              <p style={{ color: 'var(--danger)' }}>Unable to load the dataset</p>
              <p>{error}</p>
            </div>
            <button type="button" className="btn" onClick={() => window.location.reload()}>
              <RefreshCw size={13} aria-hidden="true" /> Retry
            </button>
          </div>
        </div>
      )
    }

    if (!snapshot) {
      return (
        <div className="section">
          <p className="meta">Loading the published snapshot…</p>
        </div>
      )
    }

    return (
      <>
        {isStale(snapshot.generatedAt) && <StaleBanner generatedAt={snapshot.generatedAt} />}
        <Suspense fallback={<div className="section"><p className="meta">Loading view…</p></div>}>
          {route === 'catalog' && <CatalogView snapshot={snapshot} research={research} onOpen={openModel} />}
          {route === 'value' && <ValueView snapshot={snapshot} onOpen={openModel} />}
          {route === 'changes' && <ChangesView feed={changes} onOpen={openModel} />}
          {route === 'about' && <MethodologyView snapshot={snapshot} />}
        </Suspense>
        {selected && <ModelDetail model={selected} research={research} onClose={closeModel} />}
      </>
    )
  }

  return (
    <Layout route={route} themeChoice={choice} onChooseTheme={choose}>
      {content()}
    </Layout>
  )
}
