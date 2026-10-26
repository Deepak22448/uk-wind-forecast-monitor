import type { Summary } from '@/api'
import { kpis } from '@/chartData'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function KpiCards({ summary }: { summary: Summary }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      {kpis(summary).map((k) => (
        <Card key={k.title} size="sm">
          <CardHeader>
            <CardDescription>{k.title}</CardDescription>
            <CardTitle className="text-xl tabular-nums">{k.value}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">{k.hint}</CardContent>
        </Card>
      ))}
    </div>
  )
}
