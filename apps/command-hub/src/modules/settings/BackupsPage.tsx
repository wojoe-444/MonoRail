import { PageHeader } from '@/components/layout/PageHeader'

import { BackupsCard } from './BackupsCard'

export default function BackupsPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Backups" description="One folder that every page backs up into, each in its own subfolder, on one schedule." />
      <BackupsCard />
    </div>
  )
}
