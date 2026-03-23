import { useState } from 'react'
import {
  RiLoader4Line,
  RiDeleteBinLine,
  RiListCheck2,
  RiPlugLine,
  RiSettings3Line,
  RiUploadLine,
  RiFileSearchLine,
  RiShieldKeyholeLine,
  RiFlashlightLine,
  RiAddLine,
  RiCloseLine,
  RiAlertLine,
  RiCheckboxCircleLine,
  RiLockUnlockLine,
} from '@remixicon/react'
import { toast } from 'sonner'
import { fetcher } from '~/lib/api'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '~/components/ui/accordion'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Badge } from '~/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { cn } from '~/lib/utils'

// --- Types ---

interface CommandsTabProps {
  chargerId: string
  connectors: { id: number; status: string }[]
  ocppVersion: string
}

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  onConfirm: () => void
  loading: boolean
  destructive?: boolean
}

// --- Helpers ---

function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  loading,
  destructive,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {destructive && (
              <div className="flex size-8 items-center justify-center rounded-lg bg-red-500/10">
                <RiAlertLine className="size-4 text-red-600" />
              </div>
            )}
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading && (
              <RiLoader4Line className="mr-1.5 size-3.5 animate-spin" />
            )}
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ActionButton({
  children,
  loading,
  onClick,
  variant = 'outline',
  className,
  disabled,
}: {
  children: React.ReactNode
  loading: boolean
  onClick: () => void
  variant?: 'outline' | 'default' | 'destructive'
  className?: string
  disabled?: boolean
}) {
  return (
    <Button
      size="sm"
      variant={variant}
      onClick={onClick}
      disabled={loading || disabled}
      className={className}
    >
      {loading && <RiLoader4Line className="mr-1.5 size-3.5 animate-spin" />}
      {children}
    </Button>
  )
}

function SectionNotice({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/30 px-3 py-2">
      <p className="text-xs text-amber-700">{message}</p>
    </div>
  )
}

// --- Main Component ---

export function CommandsTab({
  chargerId,
  connectors,
  ocppVersion,
}: CommandsTabProps) {
  const isOcpp16 = ocppVersion === '1.6'

  return (
    <div className="space-y-2">
      {!isOcpp16 && (
        <SectionNotice message="Some commands below are OCPP 1.6 only and may not be available for this charger." />
      )}
      <Accordion
        type="multiple"
        defaultValue={['quick-actions', 'connector-control']}
        className="[&_[data-slot=accordion-content]]:overflow-visible"
      >
        <QuickActionsSection chargerId={chargerId} />
        <ConnectorControlSection
          chargerId={chargerId}
          connectors={connectors}
        />
        <ConfigurationSection chargerId={chargerId} />
        <FirmwareSection chargerId={chargerId} />
        <DiagnosticsSection chargerId={chargerId} />
        <LocalListSection chargerId={chargerId} />
        <ChargingProfilesSection
          chargerId={chargerId}
          connectors={connectors}
        />
      </Accordion>
    </div>
  )
}

// --- Quick Actions ---

function QuickActionsSection({ chargerId }: { chargerId: string }) {
  const [clearCacheLoading, setClearCacheLoading] = useState(false)
  const [clearCacheConfirm, setClearCacheConfirm] = useState(false)
  const [listVersionLoading, setListVersionLoading] = useState(false)

  async function handleClearCache() {
    setClearCacheLoading(true)
    try {
      await fetcher(['charger.clearCache', { id: chargerId }])
      toast.success('Cache cleared successfully')
    } catch (err) {
      toast.error(
        `Clear cache failed: ${err instanceof Error ? err.message : 'Unknown error'}`
      )
    } finally {
      setClearCacheLoading(false)
      setClearCacheConfirm(false)
    }
  }

  async function handleGetLocalListVersion() {
    setListVersionLoading(true)
    try {
      const result = await fetcher<{ listVersion: number }>([
        'charger.getLocalListVersion',
        { id: chargerId },
      ])
      toast.success(`Local list version: ${result.listVersion}`)
    } catch (err) {
      toast.error(
        `Get list version failed: ${err instanceof Error ? err.message : 'Unknown error'}`
      )
    } finally {
      setListVersionLoading(false)
    }
  }

  return (
    <>
      <AccordionItem value="quick-actions">
        <AccordionTrigger>
          <div className="flex items-center gap-2">
            <RiFlashlightLine className="size-4 text-muted-foreground" />
            Quick Actions
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="flex flex-wrap gap-2 pb-2">
            <ActionButton
              loading={clearCacheLoading}
              onClick={() => setClearCacheConfirm(true)}
            >
              <RiDeleteBinLine className="mr-1.5 size-3.5" />
              Clear Cache
            </ActionButton>
            <ActionButton
              loading={listVersionLoading}
              onClick={handleGetLocalListVersion}
            >
              <RiListCheck2 className="mr-1.5 size-3.5" />
              Get Local List Version
            </ActionButton>
          </div>
        </AccordionContent>
      </AccordionItem>

      <ConfirmDialog
        open={clearCacheConfirm}
        onOpenChange={setClearCacheConfirm}
        title="Clear Cache"
        description="This will clear the charger's internal cache. The charger may need to re-fetch authorization data."
        onConfirm={handleClearCache}
        loading={clearCacheLoading}
        destructive
      />
    </>
  )
}

// --- Connector Control ---

function ConnectorControlSection({
  chargerId,
  connectors,
}: {
  chargerId: string
  connectors: { id: number; status: string }[]
}) {
  return (
    <AccordionItem value="connector-control">
      <AccordionTrigger>
        <div className="flex items-center gap-2">
          <RiPlugLine className="size-4 text-muted-foreground" />
          Connector Control
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-3 pb-2">
          {connectors.map((conn) => (
            <ConnectorRow
              key={conn.id}
              chargerId={chargerId}
              connector={conn}
            />
          ))}
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}

function statusColor(status: string) {
  switch (status) {
    case 'Available':
      return 'bg-emerald-500/15 text-emerald-700'
    case 'Charging':
    case 'Preparing':
      return 'bg-blue-500/15 text-blue-700'
    case 'SuspendedEV':
    case 'SuspendedEVSE':
    case 'Finishing':
      return 'bg-amber-500/15 text-amber-700'
    case 'Faulted':
      return 'bg-red-500/15 text-red-700'
    case 'Reserved':
      return 'bg-purple-500/15 text-purple-700'
    default:
      return 'bg-gray-500/15 text-gray-700'
  }
}

function ConnectorRow({
  chargerId,
  connector,
}: {
  chargerId: string
  connector: { id: number; status: string }
}) {
  const [availability, setAvailability] = useState('Operative')
  const [availabilityLoading, setAvailabilityLoading] = useState(false)
  const [unlockLoading, setUnlockLoading] = useState(false)
  const [unlockConfirm, setUnlockConfirm] = useState(false)

  async function handleChangeAvailability() {
    setAvailabilityLoading(true)
    try {
      await fetcher([
        'charger.changeAvailability',
        {
          id: chargerId,
          connectorId: connector.id,
          type: availability,
        },
      ])
      toast.success(`Connector #${connector.id} set to ${availability}`)
    } catch (err) {
      toast.error(
        `Change availability failed: ${err instanceof Error ? err.message : 'Unknown error'}`
      )
    } finally {
      setAvailabilityLoading(false)
    }
  }

  async function handleUnlock() {
    setUnlockLoading(true)
    try {
      await fetcher([
        'charger.unlockConnector',
        {
          id: chargerId,
          connectorId: connector.id,
        },
      ])
      toast.success(`Connector #${connector.id} unlocked`)
    } catch (err) {
      toast.error(
        `Unlock failed: ${err instanceof Error ? err.message : 'Unknown error'}`
      )
    } finally {
      setUnlockLoading(false)
      setUnlockConfirm(false)
    }
  }

  return (
    <>
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <RiPlugLine className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                Connector #{connector.id}
              </span>
              <Badge
                className={cn('text-[10px]', statusColor(connector.status))}
              >
                {connector.status}
              </Badge>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            {/* Change Availability */}
            <div className="flex items-end gap-2">
              <div className="grid gap-1">
                <Label className="text-[10px] text-muted-foreground">
                  Availability
                </Label>
                <select
                  value={availability}
                  onChange={(e) => setAvailability(e.target.value)}
                  className="flex h-8 rounded-md border border-input bg-transparent px-2 text-xs shadow-sm transition-colors focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <option value="Operative">Operative</option>
                  <option value="Inoperative">Inoperative</option>
                </select>
              </div>
              <ActionButton
                loading={availabilityLoading}
                onClick={handleChangeAvailability}
              >
                Apply
              </ActionButton>
            </div>

            {/* Unlock Connector */}
            <ActionButton
              loading={unlockLoading}
              onClick={() => setUnlockConfirm(true)}
            >
              <RiLockUnlockLine className="mr-1.5 size-3.5" />
              Unlock
            </ActionButton>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={unlockConfirm}
        onOpenChange={setUnlockConfirm}
        title="Unlock Connector"
        description={`This will send an unlock command to connector #${connector.id}. Use this to release a stuck connector.`}
        onConfirm={handleUnlock}
        loading={unlockLoading}
        destructive
      />
    </>
  )
}

// --- Configuration ---

function ConfigurationSection({ chargerId }: { chargerId: string }) {
  const [key, setKey] = useState('')
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSetConfiguration() {
    if (!key.trim()) {
      toast.error('Please enter a configuration key')
      return
    }
    setLoading(true)
    try {
      await fetcher([
        'charger.changeConfiguration',
        {
          id: chargerId,
          key: key.trim(),
          value: value.trim(),
        },
      ])
      toast.success(`Configuration "${key}" set to "${value}"`)
      setKey('')
      setValue('')
    } catch (err) {
      toast.error(
        `Set configuration failed: ${err instanceof Error ? err.message : 'Unknown error'}`
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <AccordionItem value="configuration">
      <AccordionTrigger>
        <div className="flex items-center gap-2">
          <RiSettings3Line className="size-4 text-muted-foreground" />
          Configuration
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-3 pb-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="config-key" className="text-xs">
                Key
              </Label>
              <Input
                id="config-key"
                className="h-8 text-xs"
                placeholder="e.g. HeartbeatInterval"
                value={key}
                onChange={(e) => setKey(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="config-value" className="text-xs">
                Value
              </Label>
              <Input
                id="config-value"
                className="h-8 text-xs"
                placeholder="e.g. 60"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
          </div>
          <ActionButton loading={loading} onClick={handleSetConfiguration}>
            <RiSettings3Line className="mr-1.5 size-3.5" />
            Set Configuration
          </ActionButton>
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}

// --- Firmware ---

function FirmwareSection({ chargerId }: { chargerId: string }) {
  const [location, setLocation] = useState('')
  const [retrieveDate, setRetrieveDate] = useState('')
  const [retries, setRetries] = useState('3')
  const [retryInterval, setRetryInterval] = useState('60')
  const [loading, setLoading] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  async function handleUpdateFirmware() {
    if (!location.trim()) {
      toast.error('Please enter a firmware download URL')
      return
    }
    setLoading(true)
    try {
      await fetcher([
        'charger.updateFirmware',
        {
          id: chargerId,
          location: location.trim(),
          retrieveDate: retrieveDate || undefined,
          retries: parseInt(retries) || 3,
          retryInterval: parseInt(retryInterval) || 60,
        },
      ])
      toast.success('Firmware update requested')
      setLocation('')
      setRetrieveDate('')
    } catch (err) {
      toast.error(
        `Firmware update failed: ${err instanceof Error ? err.message : 'Unknown error'}`
      )
    } finally {
      setLoading(false)
      setConfirmOpen(false)
    }
  }

  return (
    <>
      <AccordionItem value="firmware">
        <AccordionTrigger>
          <div className="flex items-center gap-2">
            <RiUploadLine className="size-4 text-muted-foreground" />
            Firmware
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-3 pb-2">
            <div className="grid gap-1.5">
              <Label htmlFor="fw-url" className="text-xs">
                Firmware URL
              </Label>
              <Input
                id="fw-url"
                className="h-8 text-xs"
                placeholder="https://example.com/firmware.bin"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label htmlFor="fw-date" className="text-xs">
                  Retrieve Date{' '}
                  <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="fw-date"
                  type="datetime-local"
                  className="h-8 text-xs"
                  value={retrieveDate}
                  onChange={(e) => setRetrieveDate(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="fw-retries" className="text-xs">
                  Retries
                </Label>
                <Input
                  id="fw-retries"
                  type="number"
                  min="0"
                  className="h-8 text-xs"
                  value={retries}
                  onChange={(e) => setRetries(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="fw-interval" className="text-xs">
                  Retry Interval (s)
                </Label>
                <Input
                  id="fw-interval"
                  type="number"
                  min="0"
                  className="h-8 text-xs"
                  value={retryInterval}
                  onChange={(e) => setRetryInterval(e.target.value)}
                />
              </div>
            </div>
            <ActionButton
              loading={loading}
              onClick={() => {
                if (!location.trim()) {
                  toast.error('Please enter a firmware download URL')
                  return
                }
                setConfirmOpen(true)
              }}
              variant="destructive"
            >
              <RiUploadLine className="mr-1.5 size-3.5" />
              Trigger Firmware Update
            </ActionButton>
          </div>
        </AccordionContent>
      </AccordionItem>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Update Firmware"
        description="This will trigger a firmware update on the charger. The charger may be temporarily unavailable during the update process."
        onConfirm={handleUpdateFirmware}
        loading={loading}
        destructive
      />
    </>
  )
}

// --- Diagnostics ---

function DiagnosticsSection({ chargerId }: { chargerId: string }) {
  const [location, setLocation] = useState('')
  const [startTime, setStartTime] = useState('')
  const [stopTime, setStopTime] = useState('')
  const [retries, setRetries] = useState('3')
  const [retryInterval, setRetryInterval] = useState('60')
  const [loading, setLoading] = useState(false)

  async function handleGetDiagnostics() {
    if (!location.trim()) {
      toast.error('Please enter a diagnostics upload URL')
      return
    }
    setLoading(true)
    try {
      const result = await fetcher<{ fileName: string }>([
        'charger.getDiagnostics',
        {
          id: chargerId,
          location: location.trim(),
          startTime: startTime || undefined,
          stopTime: stopTime || undefined,
          retries: parseInt(retries) || 3,
          retryInterval: parseInt(retryInterval) || 60,
        },
      ])
      toast.success(
        result?.fileName
          ? `Diagnostics upload started: ${result.fileName}`
          : 'Diagnostics upload requested'
      )
    } catch (err) {
      toast.error(
        `Get diagnostics failed: ${err instanceof Error ? err.message : 'Unknown error'}`
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <AccordionItem value="diagnostics">
      <AccordionTrigger>
        <div className="flex items-center gap-2">
          <RiFileSearchLine className="size-4 text-muted-foreground" />
          Diagnostics
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-3 pb-2">
          <div className="grid gap-1.5">
            <Label htmlFor="diag-url" className="text-xs">
              Upload URL
            </Label>
            <Input
              id="diag-url"
              className="h-8 text-xs"
              placeholder="ftp://example.com/diagnostics/"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="grid gap-1.5">
              <Label htmlFor="diag-start" className="text-xs">
                Start Time{' '}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="diag-start"
                type="datetime-local"
                className="h-8 text-xs"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="diag-stop" className="text-xs">
                Stop Time{' '}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="diag-stop"
                type="datetime-local"
                className="h-8 text-xs"
                value={stopTime}
                onChange={(e) => setStopTime(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="diag-retries" className="text-xs">
                Retries
              </Label>
              <Input
                id="diag-retries"
                type="number"
                min="0"
                className="h-8 text-xs"
                value={retries}
                onChange={(e) => setRetries(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="diag-interval" className="text-xs">
                Retry Interval (s)
              </Label>
              <Input
                id="diag-interval"
                type="number"
                min="0"
                className="h-8 text-xs"
                value={retryInterval}
                onChange={(e) => setRetryInterval(e.target.value)}
              />
            </div>
          </div>
          <ActionButton loading={loading} onClick={handleGetDiagnostics}>
            <RiFileSearchLine className="mr-1.5 size-3.5" />
            Request Diagnostics Upload
          </ActionButton>
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}

// --- Local Authorization List ---

interface AuthEntry {
  idTag: string
  status: string
}

function LocalListSection({ chargerId }: { chargerId: string }) {
  const [listVersion, setListVersion] = useState('1')
  const [updateType, setUpdateType] = useState<'Full' | 'Differential'>('Full')
  const [entries, setEntries] = useState<AuthEntry[]>([
    { idTag: '', status: 'Accepted' },
  ])
  const [loading, setLoading] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  function addEntry() {
    setEntries([...entries, { idTag: '', status: 'Accepted' }])
  }

  function removeEntry(index: number) {
    setEntries(entries.filter((_, i) => i !== index))
  }

  function updateEntry(index: number, field: keyof AuthEntry, value: string) {
    setEntries(
      entries.map((entry, i) =>
        i === index ? { ...entry, [field]: value } : entry
      )
    )
  }

  async function handleSendLocalList() {
    const validEntries = entries.filter((e) => e.idTag.trim())
    if (validEntries.length === 0) {
      toast.error('Please add at least one authorization entry')
      return
    }
    setLoading(true)
    try {
      await fetcher([
        'charger.sendLocalList',
        {
          id: chargerId,
          listVersion: parseInt(listVersion) || 1,
          updateType,
          localAuthorizationList: validEntries.map((e) => ({
            idTag: e.idTag.trim(),
            idTagInfo: { status: e.status },
          })),
        },
      ])
      toast.success('Local list sent successfully')
    } catch (err) {
      toast.error(
        `Send local list failed: ${err instanceof Error ? err.message : 'Unknown error'}`
      )
    } finally {
      setLoading(false)
      setConfirmOpen(false)
    }
  }

  function handleSubmit() {
    const validEntries = entries.filter((e) => e.idTag.trim())
    if (validEntries.length === 0) {
      toast.error('Please add at least one authorization entry')
      return
    }
    if (updateType === 'Full') {
      setConfirmOpen(true)
    } else {
      handleSendLocalList()
    }
  }

  return (
    <>
      <AccordionItem value="local-list">
        <AccordionTrigger>
          <div className="flex items-center gap-2">
            <RiShieldKeyholeLine className="size-4 text-muted-foreground" />
            Local Authorization List
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-3 pb-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="list-version" className="text-xs">
                  List Version
                </Label>
                <Input
                  id="list-version"
                  type="number"
                  min="1"
                  className="h-8 text-xs"
                  value={listVersion}
                  onChange={(e) => setListVersion(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Update Type</Label>
                <div className="flex gap-3">
                  {(['Full', 'Differential'] as const).map((type) => (
                    <label
                      key={type}
                      className="flex items-center gap-1.5 text-xs"
                    >
                      <input
                        type="radio"
                        name="updateType"
                        value={type}
                        checked={updateType === type}
                        onChange={() => setUpdateType(type)}
                        className="size-3.5"
                      />
                      {type}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Entries */}
            <div className="space-y-2">
              <Label className="text-xs">Authorization Entries</Label>
              {entries.map((entry, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    className="h-8 flex-1 text-xs"
                    placeholder="ID Tag"
                    value={entry.idTag}
                    onChange={(e) => updateEntry(i, 'idTag', e.target.value)}
                  />
                  <select
                    value={entry.status}
                    onChange={(e) => updateEntry(i, 'status', e.target.value)}
                    className="flex h-8 rounded-md border border-input bg-transparent px-2 text-xs shadow-sm transition-colors focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <option value="Accepted">Accepted</option>
                    <option value="Blocked">Blocked</option>
                    <option value="Expired">Expired</option>
                    <option value="Invalid">Invalid</option>
                  </select>
                  {entries.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="size-8 p-0"
                      onClick={() => removeEntry(i)}
                    >
                      <RiCloseLine className="size-3.5" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={addEntry}
              >
                <RiAddLine className="mr-1 size-3.5" />
                Add Entry
              </Button>
            </div>

            <ActionButton loading={loading} onClick={handleSubmit}>
              <RiShieldKeyholeLine className="mr-1.5 size-3.5" />
              Send Local List
            </ActionButton>
          </div>
        </AccordionContent>
      </AccordionItem>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Send Full Local List"
        description="This will replace the entire local authorization list on the charger. Any existing entries not included will be removed."
        onConfirm={handleSendLocalList}
        loading={loading}
        destructive
      />
    </>
  )
}

// --- Charging Profiles ---

function ChargingProfilesSection({
  chargerId,
  connectors,
}: {
  chargerId: string
  connectors: { id: number; status: string }[]
}) {
  return (
    <AccordionItem value="charging-profiles">
      <AccordionTrigger>
        <div className="flex items-center gap-2">
          <RiFlashlightLine className="size-4 text-muted-foreground" />
          Charging Profiles
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-4 pb-2">
          <GetCompositeSchedule chargerId={chargerId} connectors={connectors} />
          <SetChargingProfile chargerId={chargerId} connectors={connectors} />
          <ClearChargingProfile chargerId={chargerId} connectors={connectors} />
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}

function ConnectorSelect({
  connectors,
  value,
  onChange,
}: {
  connectors: { id: number }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex h-8 rounded-md border border-input bg-transparent px-2 text-xs shadow-sm transition-colors focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
    >
      <option value="0">All Connectors</option>
      {connectors.map((c) => (
        <option key={c.id} value={String(c.id)}>
          Connector {c.id}
        </option>
      ))}
    </select>
  )
}

function GetCompositeSchedule({
  chargerId,
  connectors,
}: {
  chargerId: string
  connectors: { id: number; status: string }[]
}) {
  const [connectorId, setConnectorId] = useState('0')
  const [duration, setDuration] = useState('3600')
  const [chargingRateUnit, setChargingRateUnit] = useState('W')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  async function handleGetSchedule() {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetcher<Record<string, unknown>>([
        'charger.getCompositeSchedule',
        {
          id: chargerId,
          connectorId: parseInt(connectorId),
          duration: parseInt(duration) || 3600,
          chargingRateUnit: chargingRateUnit || undefined,
        },
      ])
      setResult(JSON.stringify(res, null, 2))
      toast.success('Composite schedule retrieved')
    } catch (err) {
      toast.error(
        `Get composite schedule failed: ${err instanceof Error ? err.message : 'Unknown error'}`
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-xs font-semibold">Get Composite Schedule</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <Label className="text-[10px] text-muted-foreground">
              Connector
            </Label>
            <ConnectorSelect
              connectors={connectors}
              value={connectorId}
              onChange={setConnectorId}
            />
          </div>
          <div className="grid gap-1.5">
            <Label
              htmlFor="cs-duration"
              className="text-[10px] text-muted-foreground"
            >
              Duration (seconds)
            </Label>
            <Input
              id="cs-duration"
              type="number"
              min="1"
              className="h-8 text-xs"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-[10px] text-muted-foreground">
              Rate Unit
            </Label>
            <select
              value={chargingRateUnit}
              onChange={(e) => setChargingRateUnit(e.target.value)}
              className="flex h-8 rounded-md border border-input bg-transparent px-2 text-xs shadow-sm transition-colors focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
            >
              <option value="W">W (Watts)</option>
              <option value="A">A (Amps)</option>
            </select>
          </div>
        </div>
        <div className="mt-2">
          <ActionButton loading={loading} onClick={handleGetSchedule}>
            Get Composite Schedule
          </ActionButton>
        </div>
        {result && (
          <pre className="mt-2 max-h-48 overflow-auto rounded-lg border bg-muted/30 p-3 font-mono text-xs">
            {result}
          </pre>
        )}
      </CardContent>
    </Card>
  )
}

function SetChargingProfile({
  chargerId,
  connectors,
}: {
  chargerId: string
  connectors: { id: number; status: string }[]
}) {
  const [connectorId, setConnectorId] = useState('0')
  const [profileJson, setProfileJson] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSetProfile() {
    if (!profileJson.trim()) {
      toast.error('Please enter a charging profile JSON')
      return
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(profileJson)
    } catch {
      toast.error('Invalid JSON format')
      return
    }
    setLoading(true)
    try {
      await fetcher([
        'charger.setChargingProfile',
        {
          id: chargerId,
          connectorId: parseInt(connectorId),
          csChargingProfiles: parsed,
        },
      ])
      toast.success('Charging profile set successfully')
      setProfileJson('')
    } catch (err) {
      toast.error(
        `Set charging profile failed: ${err instanceof Error ? err.message : 'Unknown error'}`
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-xs font-semibold">Set Charging Profile</p>
        <div className="mt-2 space-y-2">
          <div className="grid gap-1.5">
            <Label className="text-[10px] text-muted-foreground">
              Connector
            </Label>
            <ConnectorSelect
              connectors={connectors}
              value={connectorId}
              onChange={setConnectorId}
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-[10px] text-muted-foreground">
              Profile JSON (csChargingProfiles)
            </Label>
            <textarea
              className="min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs shadow-sm transition-colors focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
              placeholder='{"chargingProfileId": 1, "stackLevel": 0, ...}'
              value={profileJson}
              onChange={(e) => setProfileJson(e.target.value)}
            />
          </div>
          <ActionButton loading={loading} onClick={handleSetProfile}>
            <RiFlashlightLine className="mr-1.5 size-3.5" />
            Set Charging Profile
          </ActionButton>
        </div>
      </CardContent>
    </Card>
  )
}

function ClearChargingProfile({
  chargerId,
  connectors,
}: {
  chargerId: string
  connectors: { id: number; status: string }[]
}) {
  const [chargingProfileId, setChargingProfileId] = useState('')
  const [connectorId, setConnectorId] = useState('0')
  const [purpose, setPurpose] = useState('')
  const [stackLevel, setStackLevel] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  async function handleClearProfile() {
    setLoading(true)
    try {
      await fetcher([
        'charger.clearChargingProfile',
        {
          id: chargerId,
          chargingProfileId: chargingProfileId
            ? parseInt(chargingProfileId)
            : undefined,
          connectorId: parseInt(connectorId) || undefined,
          chargingProfilePurpose: purpose || undefined,
          stackLevel: stackLevel ? parseInt(stackLevel) : undefined,
        },
      ])
      toast.success('Charging profile cleared')
    } catch (err) {
      toast.error(
        `Clear charging profile failed: ${err instanceof Error ? err.message : 'Unknown error'}`
      )
    } finally {
      setLoading(false)
      setConfirmOpen(false)
    }
  }

  return (
    <>
      <Card>
        <CardContent className="p-3">
          <p className="text-xs font-semibold">Clear Charging Profile</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="grid gap-1.5">
              <Label className="text-[10px] text-muted-foreground">
                Profile ID{' '}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                type="number"
                className="h-8 text-xs"
                placeholder="Any"
                value={chargingProfileId}
                onChange={(e) => setChargingProfileId(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-[10px] text-muted-foreground">
                Connector
              </Label>
              <ConnectorSelect
                connectors={connectors}
                value={connectorId}
                onChange={setConnectorId}
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-[10px] text-muted-foreground">
                Purpose{' '}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <select
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="flex h-8 rounded-md border border-input bg-transparent px-2 text-xs shadow-sm transition-colors focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
              >
                <option value="">Any</option>
                <option value="ChargePointMaxProfile">
                  ChargePointMaxProfile
                </option>
                <option value="TxDefaultProfile">TxDefaultProfile</option>
                <option value="TxProfile">TxProfile</option>
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-[10px] text-muted-foreground">
                Stack Level{' '}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                type="number"
                min="0"
                className="h-8 text-xs"
                placeholder="Any"
                value={stackLevel}
                onChange={(e) => setStackLevel(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-2">
            <ActionButton
              loading={loading}
              onClick={() => setConfirmOpen(true)}
              variant="destructive"
            >
              <RiDeleteBinLine className="mr-1.5 size-3.5" />
              Clear Charging Profile
            </ActionButton>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Clear Charging Profile"
        description="This will remove the matching charging profile(s) from the charger. Active power limits may be affected."
        onConfirm={handleClearProfile}
        loading={loading}
        destructive
      />
    </>
  )
}
