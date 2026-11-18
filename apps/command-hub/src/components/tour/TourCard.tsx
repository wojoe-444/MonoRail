import { Compass } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

import { startTour } from './store'

/**
 * Settings > General: take the new user tour again. Self-contained so it can
 * move to any Settings section.
 */
export function TourCard({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-start gap-4">
        <div className="min-w-0 flex-1">
          <CardTitle>New user tour</CardTitle>
          <CardDescription>A one-minute walk around the app: the rail, the main pages, Settings and the top bar.</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={startTour}>
          <Compass /> Take the tour
        </Button>
      </CardHeader>
    </Card>
  )
}
