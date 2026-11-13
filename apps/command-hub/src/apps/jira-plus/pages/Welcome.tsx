import { Lock } from 'lucide-react'

import { ProjectForm } from '../components/Dialogs'
import type { Project } from '../types'

/** First run: create the private project that every personal task goes into. */
export function Welcome({ onCreated }: { onCreated: (p: Project) => void }) {
  return (
    <div className="mx-auto max-w-xl py-8">
      <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
        <Lock className="size-6" />
      </div>
      <h2 className="text-xl font-semibold">Start with a private project</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Every task, big or small, gets a ticket. Tasks that don't belong on the team board go into your private project: it works like any
        Jira project, but it is a git repo on this computer and is never sent anywhere. Connect your team Jira later to see both side by side.
      </p>
      <div className="mt-8 rounded-xl bg-card p-6 ring-1 ring-foreground/10">
        <h2 className="mb-4 font-semibold">Create your private project</h2>
        <ProjectForm onCreated={onCreated} submitLabel="Create project" />
      </div>
    </div>
  )
}
