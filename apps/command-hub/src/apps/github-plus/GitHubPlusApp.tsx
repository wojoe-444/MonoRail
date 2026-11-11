import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'

import InitOffer from './components/InitOffer'
import { RepoProvider } from './RepoContext'
import BackupsPage from './pages/BackupsPage'
import BlobPage from './pages/BlobPage'
import BranchesPage from './pages/BranchesPage'
import CommitPage from './pages/CommitPage'
import CommitsPage from './pages/CommitsPage'
import ComparePage from './pages/ComparePage'
import RepoLayout from './pages/RepoLayout'
import TreePage from './pages/TreePage'
import Welcome from './pages/Welcome'
import './styles.css'

/**
 * GitHub+: a GitHub-style browser for local git repositories (ported from
 * wojoe-444/Local-Repo-UI). It keeps its own GitHub-dark look, scoped under
 * `.ghp` so none of it leaks into the rest of MonoRail.
 *
 * Routes live under the app's hash path, e.g. #/apps/github-plus/repo/tree.
 */
export default function GitHubPlusApp({ basePath }: { basePath: string }) {
  return (
    <div className="ghp">
      <HashRouter basename={basePath}>
        <RepoProvider>
          <Routes>
            <Route path="/" element={<Welcome />} />
            <Route path="/repo" element={<RepoLayout />}>
              <Route index element={<Navigate to="tree" replace />} />
              <Route path="tree" element={<TreePage />} />
              <Route path="blob" element={<BlobPage />} />
              <Route path="commits" element={<CommitsPage />} />
              <Route path="commit/:sha" element={<CommitPage />} />
              <Route path="branches" element={<BranchesPage />} />
              <Route path="compare" element={<ComparePage />} />
              <Route path="backups" element={<BackupsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <InitOffer />
        </RepoProvider>
      </HashRouter>
    </div>
  )
}
