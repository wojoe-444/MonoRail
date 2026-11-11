import { useState } from 'react'

import { AgentMochi, FLAVORS, MOCHI_ROLE_IDS, MOCHI_ROLES, MochiAvatar, mochiFlavorFor, mochiRoleFor } from '@/components/mochi'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/** The mochi crew: every character, the flavors, and a name tester. */
export function MochiCrewDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [name, setName] = useState('code-reviewer')
  const role = mochiRoleFor(name)
  const flavor = mochiFlavorFor(name, role)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>The mochi crew</DialogTitle>
          <DialogDescription>
            Each subagent gets a character from its name and description. The role picks the props; the flavor picks the colors, so two
            agents with the same role still look different.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-4 sm:grid-cols-5 lg:grid-cols-6">
          {MOCHI_ROLE_IDS.map((id) => (
            <div key={id} className="flex flex-col items-center gap-1.5 text-center">
              <MochiAvatar role={id} size={88} title={MOCHI_ROLES[id].label} />
              <div className="text-sm font-medium">{MOCHI_ROLES[id].label}</div>
              <div className="text-xs leading-snug text-muted-foreground">{MOCHI_ROLES[id].story}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 border-t pt-6">
          <div className="text-sm font-medium">
            {FLAVORS.length + 1} flavors <span className="font-normal text-muted-foreground">(any character works in any flavor)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {FLAVORS.map(([f]) => (
              <span key={f} title={f}>
                <MochiAvatar role="agent" flavor={f} size={32} />
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t pt-6 sm:flex-row sm:items-center">
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="mochi-name">Try an agent name</Label>
            <Input id="mochi-name" value={name} onChange={(e) => setName(e.target.value)} className="font-mono" />
          </div>
          <div className="flex items-center gap-3">
            <AgentMochi name={name || 'agent'} size={64} />
            <div className="text-sm">
              <div className="font-medium">{MOCHI_ROLES[role].label}</div>
              <div className="text-muted-foreground">{flavor}</div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
