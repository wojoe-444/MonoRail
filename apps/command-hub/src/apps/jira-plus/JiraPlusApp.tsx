import { HashRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { FlaskConical, Loader2 } from 'lucide-react'

import { isDesktop } from '@/modules/client'

import { Dialogs } from './components/Dialogs'
import { IssueModal } from './components/IssueModal'
import { TopNav } from './components/TopNav'
import { projectPath, JiraProvider, useJira } from './JiraContext'
import { ProjectsPage } from './pages/ProjectsPage'
import { ProjectView } from './pages/ProjectView'
import { Welcome } from './pages/Welcome'
import { YourWork } from './pages/YourWork'
import './styles.css'

/**
 * Jira+: a Jira-style tracker where a private local git repo is a
 * first-class project next to your team's real Jira projects. Its look is
 * its own (scoped under `.jp`); the hub bar above it is MonoRail's.
 *
 * Routes live under the app's hash path, e.g. #/apps/jira-plus/projects/local/ME/board.
 */
export default function JiraPlusApp({ basePath }: { basePath: string }) {
  return (
    <div className="jp flex min-h-full flex-col bg-(--jp-bg)">
      <HashRouter basename={basePath}>
        <JiraProvider>
          <Shell />
        </JiraProvider>
      </HashRouter>
    </div>
  )
}

function Shell() {
  const { overview, overviewError, projects } = useJira()
  const navigate = useNavigate()
  const hasLocal = projects.some((p) => p.source === 'local')
  const goTo = (p: { source: 'local' | 'jira'; key: string }) => navigate(projectPath(p))

  return (
    <>
      <TopNav />
      {!isDesktop() && (
        <div className="flex items-center gap-2 bg-(--jp-info-bg) px-6 py-2 text-sm">
          <FlaskConical className="size-4 shrink-0" /> Browser preview with fictional sample data. Open the desktop app to use your private repo and team Jira.
        </div>
      )}
      {overview?.connection.error && (
        <div className="bg-(--jp-warning-bg) px-6 py-2 text-sm text-(--jp-warning-fg)">Team Jira is unavailable: {overview.connection.error}</div>
      )}
      {overviewError && <div className="bg-(--jp-danger-bg) px-6 py-2 text-sm">{overviewError}</div>}
      <div className="min-h-0 flex-1">
        {!overview ? (
          <div className="flex items-center gap-2 p-10 text-(--jp-subtle)">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        ) : !hasLocal ? (
          <Welcome onCreated={goTo} />
        ) : (
          <Routes>
            <Route path="/" element={<YourWork />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/:source/:key/:view" element={<ProjectView />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </div>
      <IssueModal />
      <Dialogs onProjectCreated={goTo} />
    </>
  )
}
