import { useMemo, useState } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts'
import type { SeriesPoint } from '@/api'
import { dayTicks, formatDay, formatHour, formatLondon, formatMW, toChartRows } from '@/chartData'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'

const config = {
  actual: { label: 'Actual', color: 'var(--chart-1)' },
  forecast: { label: 'Forecast (latest at decision time)', color: 'var(--chart-2)' },
  band: { label: 'Forecast ± P90 error', color: 'var(--chart-2)' },
} satisfies ChartConfig

interface Props {
  points: SeriesPoint[]
  p90: number | null
  cutoffHour: number
}

export function SeriesChart({ points, p90, cutoffHour }: Props) {
  const [showBand, setShowBand] = useState(false)
  const rows = useMemo(() => toChartRows(points, showBand ? p90 : null), [points, p90, showBand])
  const ticks = useMemo(() => dayTicks(rows[0]?.t ?? 0, rows.at(-1)?.t ?? 0), [rows])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Wind generation: forecast vs actual</CardTitle>
        <CardDescription>
          Each hour uses the newest forecast published by {formatHour(cutoffHour)} (London) on the day before. Hover a
          point to see when that forecast was issued.
        </CardDescription>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showBand} onChange={(e) => setShowBand(e.target.checked)} />
          Show forecast ± P90 error band
        </label>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="aspect-auto h-96 w-full">
          <ComposedChart data={rows} margin={{ left: 8, right: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              ticks={ticks}
              tickFormatter={ticks ? formatDay : formatLondon}
              minTickGap={32}
            />
            <YAxis tickFormatter={(v: number) => `${(v / 1000).toFixed(0)} GW`} width={56} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_, p) => (p?.[0] ? formatLondon(p[0].payload.t) : '')}
                  formatter={(v, name, item) => (
                    <div className="flex flex-col">
                      <span>
                        {config[name as keyof typeof config]?.label ?? name}:{' '}
                        <b className="tabular-nums">
                          {Array.isArray(v) ? v.map((x) => formatMW(Number(x))).join(' – ') : formatMW(Number(v))} MW
                        </b>
                      </span>
                      {name === 'forecast' && item.payload.published != null && (
                        <span className="text-muted-foreground">issued {formatLondon(item.payload.published)}</span>
                      )}
                    </div>
                  )}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            {showBand && (
              <Area dataKey="band" stroke="none" fill="var(--color-band)" fillOpacity={0.15} isAnimationActive={false} />
            )}
            <Line dataKey="actual" stroke="var(--color-actual)" dot={false} strokeWidth={2} isAnimationActive={false} />
            <Line dataKey="forecast" stroke="var(--color-forecast)" dot={false} strokeWidth={2} isAnimationActive={false} />
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
