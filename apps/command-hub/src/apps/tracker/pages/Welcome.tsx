import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layers, Repeat, Target } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { trackerApi } from '../api'
import { useTracker } from '../TrackerContext'

/** First run: make a team, or try it with fictional example data. */
export function Welcome() {
  const { run } = useTracker()
  const navigate = useNavigate()
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 overflow-y-auto px-6 py-12">
      <div>
        <div className="mb-1 text-xs font-semibold tracking-[0.08em] text-primary uppercase">Tools</div>
        <h1 className="text-2xl font-semibold tracking-tight">Tracker</h1>
        <p className="mt-2 text-sm text-muted-foreground">Plan and track work the way fast product teams do: issues in teams with their own workflow, cycles, projects with milestones and updates, and initiatives above them. Everything stays on this computer.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { icon: Repeat, title: 'Cycles', text: 'Short, repeating periods of work. Unfinished issues roll over.' },
          { icon: Layers, title: 'Projects', text: 'Work toward a goal, with milestones, progress and health.' },
          { icon: Target, title: 'Initiatives', text: 'Big goals that group the projects behind them.' },
        ].map((c) => (
          <div key={c.title} className="rounded-xl p-4 ring-1 ring-foreground/10">
            <c.icon className="mb-2 size-5 text-primary" />
            <div className="text-sm font-medium">{c.title}</div>
            <div className="mt-1 text-xs text-muted-foreground">{c.text}</div>
          </div>
        ))}
      </div>
      <div className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
        <h2 className="mb-3 text-sm font-semibold">Create your first team</h2>
        <NewTeamForm />
      </div>
      <p className="text-center text-sm text-muted-foreground">
        Just looking?{' '}
        <button type="button" className="font-medium text-primary hover:underline" onClick={() => void run(() => trackerApi.addExample()).then((s) => s && navigate('/my-issues'))}>
          Add a fictional example team
        </button>{' '}
        to try things out.
      </p>
    </div>
  )
}

/** Name and key, then the team opens with the default workflow. */
export function NewTeamForm() {
  const { run } = useTracker()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [key, setKey] = useState('')
  const [touched, setTouched] = useState(false)
  const suggested = name.replace(/[^A-Za-z0-9 ]/g, '').trim().split(/\s+/).map((w) => w.slice(0, w.length > 1 && name.trim().split(/\s+/).length === 1 ? 3 : 1)).join('').toUpperCase().slice(0, 7)
  const k = touched ? key : suggested
  return (
    <form
      className="flex flex-col gap-3 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault()
        void run(() => trackerApi.createTeam({ name, key: k, cyclesEnabled: false })).then((t) => {
          if (!t) return
          setName('')
          setKey('')
          setTouched(false)
          navigate(`/team/${t.key}/issues`)
        })
      }}
    >
      <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Team name, like Engineering" required aria-label="Team name" />
      <Input
        value={k}
        onChange={(e) => {
          setTouched(true)
          setKey(e.target.value.toUpperCase())
        }}
        placeholder="KEY"
        className="font-mono sm:w-28"
        maxLength={7}
        aria-label="Team key (issue prefix)"
        title="Issue identifiers start with it, like ENG-1"
      />
      <Button type="submit" disabled={!name.trim() || !k}>
        Create team
      </Button>
    </form>
  )
}
