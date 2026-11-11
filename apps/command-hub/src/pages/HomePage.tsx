import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Bot,
  FolderGit2,
  Plus,
  Play,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'

import { Sparkline } from '@/components/charts/Sparkline'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { sampleActivity, sampleAgents, type AgentStatus } from '@/data/sample'
import { cn } from '@/lib/utils'

const statusMeta: Record<AgentStatus, { label: string; variant: 'success' | 'secondary' | 'warning' | 'destructive' }> = {
  running: { label: 'Running', variant: 'success' },
  idle: { label: 'Idle', variant: 'secondary' },
  attention: { label: 'Needs attention', variant: 'destructive' },
  paused: { label: 'Paused', variant: 'warning' },
}

const toneDot = {
  success: 'bg-success',
  warning: 'bg-warning',
  info: 'bg-info',
  destructive: 'bg-destructive',
} as const

interface Stat {
  label: string
  value: string
  delta: string
  /** Whether the delta reads as good (green) or worth a look (amber). */
  good: boolean
  /** Fictional last-7-days trend for the sparkline. */
  spark: number[]
}

const stats: Stat[] = [
  { label: 'Agents', value: '4', delta: '+1 this week', good: true, spark: [3, 3, 3, 3, 3, 4, 4] },
  { label: 'Runs today', value: '27', delta: '+12% vs. yesterday', good: true, spark: [18, 21, 17, 22, 19, 24, 27] },
  { label: 'Success rate (7d)', value: '94%', delta: '+2 pts', good: true, spark: [90, 91, 89, 92, 93, 92, 94] },
  { label: 'Needs attention', value: '1', delta: 'Inbox Digest', good: false, spark: [0, 0, 1, 0, 0, 2, 1] },
]

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export function HomePage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Overview"
        title={greeting()}
        description="Here is what your agents have been up to. Sample data is shown until agents are loaded from the repository."
        actions={
          <>
            <Button variant="outline">
              <FolderGit2 />
              Open repo
            </Button>
            <Button>
              <Plus />
              New agent
            </Button>
          </>
        }
      />

      {/* KPI tiles: 4-up on desktop, 2-up on tablet */}
      <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => {
          const Arrow = s.good ? ArrowUpRight : AlertTriangle
          return (
            <Card key={s.label} className="gap-0 p-4">
              <div className="flex items-end justify-between gap-4">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{s.label}</span>
                  <span className="text-3xl font-semibold tracking-tight tabular-nums">{s.value}</span>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 text-xs font-medium',
                      s.good ? 'text-success' : 'text-warning-soft-foreground',
                    )}
                  >
                    <Arrow className="size-3.5" />
                    {s.delta}
                  </span>
                </div>
                <Sparkline data={s.spark} className={s.good ? 'text-success' : 'text-warning'} />
              </div>
            </Card>
          )
        })}
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="gap-0 py-0 xl:col-span-2">
          <CardHeader className="border-b px-6 py-5">
            <CardTitle>Your agents</CardTitle>
            <CardDescription>Status and reliability over the last 30 runs</CardDescription>
            <CardAction>
              <Button variant="ghost" size="sm">
                View all
                <ArrowRight />
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="px-0">
            <ul className="divide-y">
              {sampleAgents.map((agent) => {
                const meta = statusMeta[agent.status]
                return (
                  <li key={agent.id} className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-muted/50">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
                      <Bot className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{agent.name}</span>
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                      </div>
                      <div className="truncate text-sm text-muted-foreground">{agent.description}</div>
                    </div>
                    <div className="hidden w-40 sm:block">
                      <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
                        <span>Success</span>
                        <span className="font-medium text-foreground tabular-nums">{agent.successRate}%</span>
                      </div>
                      <Progress
                        value={agent.successRate}
                        indicatorClassName={agent.successRate < 90 ? 'bg-warning' : 'bg-success'}
                      />
                    </div>
                    <div className="hidden w-20 text-right text-xs text-muted-foreground md:block">{agent.lastRun}</div>
                    <Button variant="ghost" size="icon" aria-label={`Run ${agent.name}`}>
                      <Play />
                    </Button>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>

        <Card className="gap-0 py-0">
          <CardHeader className="border-b px-6 py-5">
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Latest events across all agents</CardDescription>
          </CardHeader>
          <CardContent className="px-6 py-2">
            <ol className="relative">
              {sampleActivity.map((item, i) => (
                <li key={item.id} className="relative flex gap-4 py-3">
                  {i < sampleActivity.length - 1 && (
                    <span className="absolute top-7 bottom-[-12px] left-[5px] w-px bg-border" />
                  )}
                  <span className={cn('relative mt-1.5 size-[11px] shrink-0 rounded-full ring-4 ring-card', toneDot[item.tone])} />
                  <div className="min-w-0">
                    <div className="text-sm">
                      <span className="font-medium">{item.agent}</span>
                      <span className="text-muted-foreground"> · {item.time}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">{item.message}</div>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold tracking-tight">Get started</h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <QuickLink
            icon={Plus}
            tone="bg-primary text-primary-foreground"
            title="Create an agent"
            body="Add a new agent definition to the MonoRail repository."
          />
          <QuickLink
            icon={FolderGit2}
            tone="bg-highlight text-highlight-foreground"
            title="Browse the repo"
            body="See every agent stored in wojoe-444/MonoRail."
          />
          <QuickLink
            icon={ShieldCheck}
            tone="bg-success text-white"
            title="Private data stays local"
            body="Keys and personal data live in your AppData folder, never in git."
          />
        </div>
      </section>

      <Separator />
      <footer className="pb-2 text-xs text-muted-foreground">MonoRail · v{__APP_VERSION__}</footer>
    </div>
  )
}

function QuickLink({ icon: Icon, tone, title, body }: { icon: LucideIcon; tone: string; title: string; body: string }) {
  return (
    <Card className="group cursor-pointer gap-0 py-5 transition-shadow hover:shadow-elevation-3">
      <CardContent className="flex items-start gap-4 px-5">
        <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg shadow-elevation-1', tone)}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 font-medium">
            {title}
            <ArrowUpRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
          <div className="mt-0.5 text-sm text-muted-foreground">{body}</div>
        </div>
      </CardContent>
    </Card>
  )
}
