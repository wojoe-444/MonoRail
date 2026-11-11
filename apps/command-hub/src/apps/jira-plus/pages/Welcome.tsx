import { Lock } from 'lucide-react'

import { ProjectForm } from '../components/Dialogs'
import type { Project } from '../types'

/** First run: create the private project that every personal task goes into. */
export function Welcome({ onCreated }: { onCreated: (p: Project) => void }) {
  return (
    <div className="mx-auto max-w-xl px-6 py-16">
      <div className="mb-4 flex size-12 items-center justify-center rounded-md bg-(--jp-local-bg) text-(--jp-local)">
        <Lock className="size-6" />
      </div>
      <h1 className="text-2xl font-medium">Welcome to Jira+</h1>
      <p className="mt-2 leading-6 text-(--jp-subtle)">
        Treat every task, big or small, as a Jira issue. Tasks that don't belong on the team board go into your private project. It looks and works
        like any Jira project, but it is a git repo on this computer and is never sent anywhere. Connect your team Jira later to see both side by side.
      </p>
      <div className="mt-8 rounded-[3px] bg-(--jp-raised) p-6 shadow-(--jp-shadow-raised)">
        <h2 className="mb-4 font-semibold">Create your private project</h2>
        <ProjectForm onCreated={onCreated} submitLabel="Create project" />
      </div>
    </div>
  )
}
