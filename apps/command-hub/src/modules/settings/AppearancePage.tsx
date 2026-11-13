import { PageHeader } from '@/components/layout/PageHeader'
import { AppearanceCard } from '@/components/theme/ThemePicker'

export default function AppearancePage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Appearance" description="Pick a color scheme and light or dark mode. Each profile keeps its own." />
      <AppearanceCard />
    </div>
  )
}
