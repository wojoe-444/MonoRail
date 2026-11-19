import type { MetricType } from '@/modules/semantic/types'

export const TYPE_TONE: Record<MetricType, 'default' | 'secondary' | 'info' | 'success' | 'warning'> = {
  simple: 'secondary',
  ratio: 'info',
  cumulative: 'success',
  derived: 'warning',
  conversion: 'default',
}

export const TYPE_HELP: Record<MetricType, string> = {
  simple: 'One measure, aggregated.',
  ratio: 'One metric divided by another.',
  cumulative: 'A running total over a window or grain to date.',
  derived: 'An expression over other metrics.',
  conversion: 'How many of one event go on to another.',
}
