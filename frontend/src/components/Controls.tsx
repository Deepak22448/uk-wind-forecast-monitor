import type { Meta, Query } from '@/api'
import { formatHour } from '@/chartData'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const HOURS = Array.from({ length: 24 }, (_, h) => h)

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function Controls({ meta, query, onChange }: { meta: Meta; query: Query; onChange: (q: Query) => void }) {
  const weekEnd = addDays(meta.first_day, 6)
  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="start">From (delivery day)</Label>
        <Input
          id="start"
          type="date"
          min={meta.first_day}
          max={query.end}
          value={query.start}
          onChange={(e) => e.target.value && onChange({ ...query, start: e.target.value })}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="end">To (delivery day)</Label>
        <Input
          id="end"
          type="date"
          min={query.start}
          max={meta.last_day}
          value={query.end}
          onChange={(e) => e.target.value && onChange({ ...query, end: e.target.value })}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="cutoff">Decision time (day before, London)</Label>
        <Select
          value={String(query.cutoffHour)}
          onValueChange={(v) => v !== null && onChange({ ...query, cutoffHour: Number(v) })}
        >
          <SelectTrigger id="cutoff" className="w-36">
            <SelectValue>{formatHour(query.cutoffHour)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {HOURS.map((h) => (
              <SelectItem key={h} value={String(h)}>
                {formatHour(h)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => onChange({ ...query, start: meta.first_day, end: weekEnd })}>
          First week
        </Button>
        <Button variant="outline" onClick={() => onChange({ ...query, start: meta.first_day, end: meta.last_day })}>
          Full month
        </Button>
      </div>
    </div>
  )
}
