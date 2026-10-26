import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { formatMW } from '@/chartData'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'

interface Bucket {
  label: string
  mae: number
  bias: number
}

const config = {
  mae: { label: 'MAE', color: 'var(--chart-5)' },
  bias: { label: 'Bias', color: 'var(--chart-3)' },
} satisfies ChartConfig

export function BucketChart({ title, description, data }: { title: string; description: string; data: Bucket[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="aspect-auto h-64 w-full">
          <BarChart data={data} margin={{ left: 8, right: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" interval="preserveStartEnd" />
            <YAxis tickFormatter={(v: number) => `${(v / 1000).toFixed(1)}k`} width={44} />
            <ChartTooltip
              content={<ChartTooltipContent formatter={(v, name) => `${config[name as keyof typeof config]?.label}: ${formatMW(Number(v), name === 'bias')} MW`} />}
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="mae" fill="var(--color-mae)" radius={2} isAnimationActive={false} />
            <Bar dataKey="bias" fill="var(--color-bias)" radius={2} isAnimationActive={false} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
