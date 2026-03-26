import { Card, CardContent } from '~/components/ui/card'
import { useChargerContext } from './types'

export default function InfoPage() {
  const { charger } = useChargerContext()

  return (
    <Card>
      <CardContent className="p-5">
        <div className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <InfoRow label="Charge Point ID" value={charger.chargePointId} />
          <InfoRow label="OCPP Version" value={charger.ocppVersion} />
          <InfoRow label="Vendor" value={charger.vendor || '—'} />
          <InfoRow label="Model" value={charger.model || '—'} />
          <InfoRow label="Serial Number" value={charger.serialNumber || '—'} />
          <InfoRow
            label="Charge Box Serial"
            value={charger.chargeBoxSerialNumber || '—'}
          />
          <InfoRow label="Firmware" value={charger.firmwareVersion || '—'} />
          <InfoRow label="Firmware Status" value={charger.firmwareStatus} />
          <InfoRow
            label="Diagnostics Status"
            value={charger.diagnosticsStatus}
          />
          <InfoRow
            label="Connector Count"
            value={String(charger.connectorCount)}
          />
          <InfoRow label="Max Power" value={`${charger.maxPowerKw} kW`} />
          <InfoRow
            label="Heartbeat Interval"
            value={`${charger.heartbeatInterval}s`}
          />
          <InfoRow
            label="Registered"
            value={new Date(charger.createdAt).toLocaleDateString([], {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          />
        </div>
      </CardContent>
    </Card>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate font-medium">{value}</dd>
    </div>
  )
}
