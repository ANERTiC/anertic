import { CommandsTab } from '~/components/commands-tab'
import { useChargerContext } from './types'

export default function CommandsPage() {
  const { charger } = useChargerContext()

  return (
    <CommandsTab
      chargerId={charger.id}
      connectors={charger.connectors.map((c) => ({
        id: c.id,
        status: c.status,
      }))}
      ocppVersion={charger.ocppVersion}
    />
  )
}
