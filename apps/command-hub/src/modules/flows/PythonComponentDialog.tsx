import { useState } from 'react'
import { CheckCircle2, Play, ShieldAlert, SquareFunction } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'

import { PORT_COLOR } from './components'
import { SAMPLE_PYTHON } from './sample'

/**
 * Design preview: the Python component editor. Inputs and outputs are read
 * from the function signature; nothing runs until the user allows this exact
 * code (a change to the code asks again).
 */
export function PythonComponentDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [code, setCode] = useState(SAMPLE_PYTHON)
  const [allowed, setAllowed] = useState(false)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-hidden sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><SquareFunction className="size-5 text-warning-soft-foreground" /> Score readability</DialogTitle>
          <DialogDescription>A Python component. Write a function; its arguments become input ports and its return value the output.</DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 gap-4 md:grid-cols-[1fr_17rem]">
          <div className="min-h-0 overflow-hidden rounded-lg border bg-muted/40">
            <div className="flex h-9 items-center gap-2 border-b px-3 text-xs text-muted-foreground">
              <span className="font-mono">score_readability.py</span>
              <div className="flex-1" />
              <span>Python 3.12 · your own install</span>
            </div>
            <textarea
              value={code}
              onChange={(e) => { setCode(e.target.value); setAllowed(false) }}
              spellCheck={false}
              className="h-[24rem] w-full resize-none bg-transparent p-3 font-mono text-xs leading-relaxed outline-none"
            />
          </div>
          <div className="space-y-4 text-sm">
            <div>
              <div className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Ports found</div>
              <ul className="space-y-1.5">
                <li className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: PORT_COLOR.text }} /><span className="font-mono text-xs">text</span><span className="ml-auto text-xs text-muted-foreground">input · Text</span></li>
                <li className="flex items-center gap-2"><span className="size-2.5 rounded-full border border-dashed border-muted-foreground" /><span className="font-mono text-xs">target_grade</span><span className="ml-auto text-xs text-muted-foreground">setting · 8</span></li>
                <li className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: PORT_COLOR.data }} /><span className="font-mono text-xs">score</span><span className="ml-auto text-xs text-muted-foreground">output · Data</span></li>
              </ul>
            </div>
            <div>
              <div className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Packages</div>
              <div className="flex items-center gap-2 text-xs"><CheckCircle2 className="size-4 text-success" /> Standard library only</div>
            </div>
            <div className="rounded-lg bg-warning-soft p-3 text-warning-soft-foreground">
              <div className="flex items-center gap-2 font-medium"><ShieldAlert className="size-4" /> Runs on your PC</div>
              <p className="mt-1 text-xs leading-relaxed">
                This code runs with your own Python and your permissions. It is not sandboxed: it can read and change files and reach the internet. Only allow code you wrote or trust.
              </p>
              <label className="mt-3 flex items-center justify-between gap-2 text-xs font-medium">
                Allow this code to run
                <Switch checked={allowed} onCheckedChange={setAllowed} />
              </label>
              <p className="mt-1 text-[11px] opacity-80">Changing the code turns this off again.</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline">Timeout 60 s</Badge>
              <Badge variant="outline">Logs: metadata only</Badge>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={!allowed}><Play /> Test with sample input</Button>
          <Button onClick={() => onOpenChange(false)}>Save component</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
