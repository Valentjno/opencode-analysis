import type { ReactNode } from 'react'
import { GitBranch } from 'lucide-react'
import type { ThemeChoice } from '../lib/theme'
import { ThemeToggle } from './ThemeToggle'

export type Route = 'overview' | 'models' | 'analysis' | 'changes' | 'about'

interface LayoutProps {
  route: Route
  themeChoice: ThemeChoice
  onChooseTheme: (choice: ThemeChoice) => void
  children: ReactNode
}

const NAV: { route: Route; label: string; index: string }[] = [
  { route: 'overview', label: 'Overview', index: '01' },
  { route: 'models', label: 'Models', index: '02' },
  { route: 'analysis', label: 'Analysis', index: '03' },
  { route: 'changes', label: 'Changes', index: '04' },
  { route: 'about', label: 'About', index: '05' },
]

function Footer() {
  return (
    <footer className="site-footer">
      <div className="shell">
        <div className="footer-grid">
          <div>
            <p className="footer-title">OpenCode Analysis</p>
            <p className="footer-copy">
              An independent view for OpenCode developers: understand which Go and free models make
              the best use of your monthly allowance, based on your privacy needs. Not affiliated
              with OpenCode or Artificial Analysis.
            </p>
          </div>
          <div className="footer-links">
            <span className="meta">Sources</span>
            <a href="https://opencode.ai/" target="_blank" rel="noreferrer noopener">
              OpenCode ↗
            </a>
            <a href="https://artificialanalysis.ai/" target="_blank" rel="noreferrer noopener">
              Artificial Analysis ↗
            </a>
            <a href="https://opencode.ai/console/go" target="_blank" rel="noreferrer noopener">
              OpenCode Go plans ↗
            </a>
          </div>
          <div className="footer-links">
            <span className="meta">Project</span>
            <a href="https://github.com/Valentjno/opencode-analysis" target="_blank" rel="noreferrer noopener">
              <GitBranch size={12} aria-hidden="true" /> Source & data
            </a>
            <a href="#about">Methodology</a>
            <a href="https://github.com/Valentjno/opencode-analysis/blob/main/LICENSE" target="_blank" rel="noreferrer noopener">
              MIT license
            </a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>Independent · free · no cookies · refreshed every 12h</span>
          <span>Model data © OpenCode · Benchmarks © Artificial Analysis</span>
        </div>
      </div>
    </footer>
  )
}

export function Layout({ route, themeChoice, onChooseTheme, children }: LayoutProps) {
  return (
    <>
      <header className="topbar">
        <div className="shell topbar-inner">
          <a className="brand" href="#catalog" aria-label="OpenCode Model Radar home">
            <span className="brand-mark mono" aria-hidden="true">&lt;/&gt;</span>
            <span className="brand-name">opencode<span> analysis</span></span>
          </a>
          <nav className="nav" aria-label="Sections">
            {NAV.map((item) => (
              <a
                key={item.route}
                className="nav-link"
                href={`#${item.route}`}
                aria-current={route === item.route ? 'page' : undefined}
              >
                <span className="nav-index">[{item.index}]</span> {item.label}
              </a>
            ))}
          </nav>
          <div className="topbar-actions">
            <ThemeToggle choice={themeChoice} onChoose={onChooseTheme} />
          </div>
        </div>
      </header>

      <main className="shell">{children}</main>
      <Footer />
    </>
  )
}
