import { useState } from 'react'
import { fetchMeta, fetchMetrics, fetchSeries, type Meta, type Query } from '@/api'
import { horizonLabel } from '@/chartData'
import { BucketChart } from '@/components/BucketChart'
import { Controls } from '@/components/Controls'
import { KpiCards } from '@/components/KpiCards'
import { SeriesChart } from '@/components/SeriesChart'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { useFetch } from '@/useFetch'

export default function App() {
  const { data: meta, error } = useFetch(fetchMeta, 'meta')

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="mx-auto flex max-w-7xl items-baseline justify-between gap-4 px-4 py-4 md:px-8">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">UK Wind Forecast Monitor</h1>
            <p className="text-sm text-muted-foreground">Day-ahead wind forecast accuracy for Great Britain</p>
          </div>
          <p className="hidden text-sm text-muted-foreground sm:block">Elexon BMRS · January 2026 decisions</p>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 md:px-8">
        {error && <ErrorAlert message={error} />}
        {!error && !meta && <LoadingSkeleton />}
        {meta && <Dashboard meta={meta} />}
      </main>

      <footer className="border-t">
        <p className="mx-auto max-w-7xl px-4 py-4 text-xs text-muted-foreground md:px-8">
          Error = forecast − actual, so a positive error means the forecast ran high. Actuals: Elexon FUELHH. Forecasts:
          Elexon WINDFOR. National GB wind only.
        </p>
      </footer>
    </div>
  )
}

const ErrorAlert = ({ message }: { message: string }) => (
  <Alert variant="destructive">
    <AlertTitle>Could not load data</AlertTitle>
    <AlertDescription>{message}</AlertDescription>
  </Alert>
)

const LoadingSkeleton = () => (
  <div className="grid gap-4" aria-busy="true">
    <Skeleton className="h-24 w-full" />
    <Skeleton className="h-96 w-full" />
  </div>
)

function Dashboard({ meta }: { meta: Meta }) {
  const [query, setQuery] = useState<Query>({
    start: meta.first_day,
    end: meta.last_day,
    cutoffHour: meta.default_cutoff_hour,
  })
  const key = JSON.stringify(query)
  const series = useFetch((s) => fetchSeries(query, s), key)
  const metrics = useFetch((s) => fetchMetrics(query, s), key)
  const error = series.error ?? metrics.error

  return (
    <>
      <Controls meta={meta} query={query} onChange={setQuery} />

      {error && <ErrorAlert message={error} />}
      {!error && (!metrics.data || !series.data) && <LoadingSkeleton />}

      {!error && metrics.data && series.data && (
        <div className={`grid gap-6 transition-opacity ${series.loading || metrics.loading ? 'opacity-60' : ''}`}>
          {series.data.length === 0 ? (
            <Alert>
              <AlertTitle>No data for this range</AlertTitle>
              <AlertDescription>Pick different delivery days.</AlertDescription>
            </Alert>
          ) : (
            <>
              <KpiCards summary={metrics.data.summary} />
              <SeriesChart points={series.data} p90={metrics.data.summary.p90} cutoffHour={query.cutoffHour} />
              <div className="grid gap-6 lg:grid-cols-2">
                <BucketChart
                  title="Error by hour of day"
                  description="Delivery hour, London time"
                  data={metrics.data.by_hour.map((b) => ({ label: String(b.hour), mae: b.mae, bias: b.bias }))}
                />
                <BucketChart
                  title="Error by forecast age"
                  description="Hours between publication and delivery"
                  data={metrics.data.by_horizon.map((b) => ({
                    label: horizonLabel(b.horizon_bucket_start),
                    mae: b.mae,
                    bias: b.bias,
                  }))}
                />
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
