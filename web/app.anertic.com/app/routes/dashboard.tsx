export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Energy monitoring overview
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Solar Production" value="--" unit="kWh" />
        <StatCard title="Grid Usage" value="--" unit="kWh" />
        <StatCard title="Active Chargers" value="--" unit="" />
        <StatCard title="Total Devices" value="--" unit="" />
      </div>
    </div>
  )
}

function StatCard({ title, value, unit }: { title: string; value: string; unit: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="mt-1 text-2xl font-semibold">
        {value} <span className="text-sm font-normal text-muted-foreground">{unit}</span>
      </p>
    </div>
  )
}
