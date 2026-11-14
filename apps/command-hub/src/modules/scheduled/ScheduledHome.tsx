import { CalendarClock, Workflow } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { navigate } from '@/lib/router'

export default function ScheduledHome() {
  return <div className="flex flex-col gap-8"><PageHeader eyebrow="Workspace" title="Scheduled" description="See and manage work scheduled on this computer." /><Card><CardHeader><div className="flex items-center gap-2 font-semibold"><CalendarClock className="size-5" /> Windows Task Scheduler</div></CardHeader><CardContent className="flex flex-wrap items-center justify-between gap-4"><p className="text-sm text-muted-foreground">Review task schedules, results, and state.</p><Button onClick={() => navigate('/scheduled/windows')}>View tasks</Button></CardContent></Card><Card><CardHeader><div className="flex items-center gap-2 font-semibold"><Workflow className="size-5" /> In-App</div></CardHeader><CardContent className="flex flex-wrap items-center justify-between gap-4"><p className="text-sm text-muted-foreground">Backups, reports and checks MonoRail runs while it is open.</p><Button onClick={() => navigate('/scheduled/in-app')}>View jobs</Button></CardContent></Card></div>
}
