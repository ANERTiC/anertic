import { useEffect, useState } from 'react'
import { useFetcher, useNavigate } from 'react-router'
import useSWR from 'swr'
import { toast } from 'sonner'

import { fetcher } from '~/lib/api'
import { api } from '~/lib/api.server'
import {
  RiFlashlightLine,
  RiSettings3Line,
  RiEditLine,
  RiDeleteBinLine,
  RiUploadLine,
  RiShieldKeyholeLine,
  RiAddLine,
  RiSaveLine,
  RiLoader4Line,
} from '@remixicon/react'

import { useSiteId } from '~/layouts/site'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { cn } from '~/lib/utils'
import { OcppUrlStrip } from '../charger-detail'

import type { Route } from './+types/settings'
import {
  useChargerContext,
  type AuthTag,
  type ChargingProfileData,
  type ConnectorDetail,
} from './types'

// Mock OCPP configuration keys
const MOCK_CONFIG_KEYS = [
  { key: 'HeartbeatInterval', value: '60', readonly: false },
  { key: 'MeterValueSampleInterval', value: '30', readonly: false },
  { key: 'ClockAlignedDataInterval', value: '0', readonly: false },
  { key: 'ConnectionTimeOut', value: '120', readonly: false },
  {
    key: 'MeterValuesAlignedData',
    value: 'Energy.Active.Import.Register',
    readonly: false,
  },
  {
    key: 'MeterValuesSampledData',
    value: 'Energy.Active.Import.Register,Power.Active.Import',
    readonly: false,
  },
  { key: 'NumberOfConnectors', value: '2', readonly: true },
  { key: 'ChargePointModel', value: 'Terra AC W22-T-RD-M-0', readonly: true },
  { key: 'ChargePointVendor', value: 'ABB', readonly: true },
  {
    key: 'SupportedFeatureProfiles',
    value: 'Core,FirmwareManagement,LocalAuthListManagement,SmartCharging',
    readonly: true,
  },
  { key: 'AuthorizeRemoteTxRequests', value: 'true', readonly: false },
  { key: 'LocalAuthListEnabled', value: 'true', readonly: false },
  { key: 'LocalPreAuthorize', value: 'false', readonly: false },
  { key: 'StopTransactionOnEVSideDisconnect', value: 'true', readonly: false },
  { key: 'UnlockConnectorOnEVSideDisconnect', value: 'true', readonly: false },
]

export async function loader({ params, request }: Route.LoaderArgs) {
  try {
    const [authResult, profilesResult] = await Promise.all([
      api<{ items: AuthTag[] }>(request, 'charger.listAuthTags', {
        id: params.chargerId,
      }),
      api<{ items: ChargingProfileData[] }>(
        request,
        'charger.listChargingProfiles',
        { id: params.chargerId }
      ),
    ])
    return {
      authTags: authResult.result.items ?? [],
      profiles: profilesResult.result.items ?? [],
    }
  } catch {
    return {
      authTags: [] as AuthTag[],
      profiles: [] as ChargingProfileData[],
    }
  }
}

export async function clientAction({ request }: { request: Request }) {
  const formData = await request.formData()
  const intent = formData.get('intent')

  switch (intent) {
    case 'addAuthTag': {
      const id = String(formData.get('chargerId'))
      const idTag = String(formData.get('idTag'))
      const result = await fetcher<{ id: string }>([
        'charger.addAuthTag',
        { id, idTag },
      ])
      return { ok: true, intent, idTag, ...result }
    }
    case 'removeAuthTag': {
      const id = String(formData.get('chargerId'))
      const authTagId = String(formData.get('authTagId'))
      await fetcher(['charger.removeAuthTag', { id, authTagId }])
      return { ok: true, intent, authTagId }
    }
    case 'setChargingProfile': {
      const id = String(formData.get('chargerId'))
      const connectorId = Number(formData.get('connectorId'))
      const profileJson = String(formData.get('profileJson'))
      const parsed = JSON.parse(profileJson)
      await fetcher([
        'charger.setChargingProfile',
        { id, connectorId, csChargingProfiles: parsed },
      ])
      return { ok: true, intent }
    }
    case 'clearChargingProfile': {
      const id = String(formData.get('chargerId'))
      const profileId = formData.get('chargingProfileId')
      await fetcher([
        'charger.clearChargingProfile',
        {
          id,
          chargingProfileId: profileId ? Number(profileId) : undefined,
        },
      ])
      return { ok: true, intent, chargingProfileId: profileId }
    }
    default:
      throw new Response('Invalid intent', { status: 400 })
  }
}

export default function SettingsPage({ loaderData }: Route.ComponentProps) {
  const { charger } = useChargerContext()
  const navigate = useNavigate()
  const siteId = useSiteId()
  const [configKeys, setConfigKeys] = useState(
    MOCK_CONFIG_KEYS.map((k) => ({ ...k, editing: false, editValue: k.value }))
  )
  const { data: authData, mutate: mutateAuth } = useSWR<{ items: AuthTag[] }>(
    ['charger.listAuthTags', { id: charger.id }],
    fetcher,
    { fallbackData: { items: loaderData.authTags } }
  )
  const authList = authData?.items ?? []
  const [newIdTag, setNewIdTag] = useState('')
  const addFetcher = useFetcher()
  const removeFetcher = useFetcher()
  const { data: profilesData, mutate: mutateProfiles } = useSWR<{
    items: ChargingProfileData[]
  }>(['charger.listChargingProfiles', { id: charger.id }], fetcher, {
    fallbackData: { items: loaderData.profiles },
  })
  const profiles = profilesData?.items ?? []
  const setProfileFetcher = useFetcher()
  const clearProfileFetcher = useFetcher()
  const [profileDialogOpen, setProfileDialogOpen] = useState(false)
  const [firmwareUrl, setFirmwareUrl] = useState('')
  const [displayName, setDisplayName] = useState(charger.chargePointId)
  const [maxPower, setMaxPower] = useState(String(charger.maxPowerKw))

  function handleEditConfig(key: string) {
    setConfigKeys((prev) =>
      prev.map((k) =>
        k.key === key ? { ...k, editing: true, editValue: k.value } : k
      )
    )
  }

  function handleSaveConfig(key: string) {
    setConfigKeys((prev) =>
      prev.map((k) =>
        k.key === key ? { ...k, editing: false, value: k.editValue } : k
      )
    )
    toast.success(`Configuration "${key}" updated`)
  }

  function handleCancelConfig(key: string) {
    setConfigKeys((prev) =>
      prev.map((k) => (k.key === key ? { ...k, editing: false } : k))
    )
  }

  useEffect(() => {
    if (addFetcher.state === 'idle' && addFetcher.data?.ok) {
      toast.success(`ID tag "${addFetcher.data.idTag}" added`)
      setNewIdTag('')
      mutateAuth()
    }
  }, [addFetcher.state, addFetcher.data])

  useEffect(() => {
    if (removeFetcher.state === 'idle' && removeFetcher.data?.ok) {
      mutateAuth()
    }
  }, [removeFetcher.state, removeFetcher.data])

  useEffect(() => {
    if (setProfileFetcher.state === 'idle' && setProfileFetcher.data?.ok) {
      toast.success('Charging profile set successfully')
      setProfileDialogOpen(false)
      mutateProfiles()
    }
  }, [setProfileFetcher.state, setProfileFetcher.data])

  useEffect(() => {
    if (clearProfileFetcher.state === 'idle' && clearProfileFetcher.data?.ok) {
      toast.success('Charging profile cleared')
      mutateProfiles()
    }
  }, [clearProfileFetcher.state, clearProfileFetcher.data])

  const clearingProfileId = clearProfileFetcher.formData?.get(
    'chargingProfileId'
  ) as string | null
  const visibleProfiles = profiles.filter(
    (p) => String(p.chargingProfileId) !== clearingProfileId
  )

  const removingTagId = removeFetcher.formData?.get('authTagId') as
    | string
    | null
  const visibleAuthList = authList.filter((t) => t.id !== removingTagId)

  function handleFirmwareUpdate() {
    if (!firmwareUrl.trim()) return
    toast.success('Firmware update requested')
    setFirmwareUrl('')
  }

  function handleRequestDiagnostics() {
    toast.success('Diagnostics upload requested')
  }

  function handleSaveGeneral() {
    toast.success('Charger settings saved')
  }

  function handleDeleteCharger() {
    if (
      confirm(
        'Are you sure you want to delete this charger? This action cannot be undone.'
      )
    ) {
      toast.success('Charger deleted')
      navigate(`/chargers?site=${siteId}`)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* OCPP Connection */}
      <Card>
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold">OCPP Connection</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Configure your charger to connect to this WebSocket endpoint
          </p>
          <div className="mt-3">
            <OcppUrlStrip chargePointId={charger.chargePointId} />
          </div>
        </CardContent>
      </Card>

      {/* General Settings */}
      <Card>
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold">General</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Basic charger configuration
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="displayName" className="text-xs">
                Display Name
              </Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="maxPower" className="text-xs">
                Max Power (kW)
              </Label>
              <Input
                id="maxPower"
                type="number"
                value={maxPower}
                onChange={(e) => setMaxPower(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button size="sm" onClick={handleSaveGeneral}>
              <RiSaveLine aria-hidden="true" data-icon="inline-start" />
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* OCPP Configuration */}
      <Card>
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold">OCPP Configuration</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Read and modify charge point configuration keys
          </p>
          <div className="mt-4">
            <div className="rounded-lg border">
              <div className="grid grid-cols-[1fr_1fr_auto] gap-2 border-b bg-muted/50 px-3 py-2 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                <span>Key</span>
                <span>Value</span>
                <span className="w-6" />
              </div>
              <div className="divide-y">
                {configKeys.map((config) => (
                  <div
                    key={config.key}
                    className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 px-3 py-2"
                  >
                    <div>
                      <span className="text-xs font-medium">{config.key}</span>
                      {config.readonly && (
                        <span className="ml-1.5 text-[10px] text-muted-foreground">
                          (read-only)
                        </span>
                      )}
                    </div>
                    <div>
                      {config.editing ? (
                        <Input
                          className="h-7 text-xs"
                          value={config.editValue}
                          onChange={(e) =>
                            setConfigKeys((prev) =>
                              prev.map((k) =>
                                k.key === config.key
                                  ? { ...k, editValue: e.target.value }
                                  : k
                              )
                            )
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveConfig(config.key)
                            if (e.key === 'Escape')
                              handleCancelConfig(config.key)
                          }}
                          autoFocus
                        />
                      ) : (
                        <span className="truncate text-xs text-muted-foreground tabular-nums">
                          {config.value}
                        </span>
                      )}
                    </div>
                    <div className="flex shrink-0 justify-end">
                      {config.editing ? (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[10px]"
                            onClick={() => handleSaveConfig(config.key)}
                          >
                            Save
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[10px]"
                            onClick={() => handleCancelConfig(config.key)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : !config.readonly ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          aria-label={`Edit ${config.key}`}
                          onClick={() => handleEditConfig(config.key)}
                        >
                          <RiEditLine aria-hidden="true" className="size-3" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charging Profiles */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Charging Profiles</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Set power limits and time-based charging schedules
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setProfileDialogOpen(true)}
            >
              <RiAddLine aria-hidden="true" data-icon="inline-start" />
              Create Profile
            </Button>
          </div>
          {visibleProfiles.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed p-6 text-center">
              <RiFlashlightLine
                aria-hidden="true"
                className="mx-auto size-8 text-muted-foreground/40"
              />
              <p className="mt-2 text-sm text-muted-foreground">
                No charging profiles configured
              </p>
            </div>
          ) : (
            <div className="mt-4 rounded-lg border">
              <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-2 border-b bg-muted/50 px-3 py-2 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                <span>ID</span>
                <span>Purpose</span>
                <span>Kind</span>
                <span>Connector</span>
                <span className="sr-only">Actions</span>
              </div>
              <div className="divide-y">
                {visibleProfiles.map((profile) => (
                  <div
                    key={profile.id}
                    className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-2 px-3 py-2"
                  >
                    <span className="flex items-center gap-2 text-xs font-medium tabular-nums">
                      <RiFlashlightLine
                        aria-hidden="true"
                        className="size-3.5 text-muted-foreground"
                      />
                      #{profile.chargingProfileId}
                    </span>
                    <div className="flex flex-col">
                      <Badge
                        className={cn(
                          'w-fit text-[10px]',
                          profile.chargingProfilePurpose ===
                            'ChargePointMaxProfile'
                            ? 'bg-blue-500/15 text-blue-700'
                            : profile.chargingProfilePurpose ===
                                'TxDefaultProfile'
                              ? 'bg-amber-500/15 text-amber-700'
                              : 'bg-purple-500/15 text-purple-700'
                        )}
                      >
                        {profile.chargingProfilePurpose}
                      </Badge>
                      {profile.schedule && (
                        <span className="mt-0.5 text-[10px] text-muted-foreground">
                          {profile.schedule.chargingSchedulePeriod.length}{' '}
                          period
                          {profile.schedule.chargingSchedulePeriod.length !== 1
                            ? 's'
                            : ''}
                          {' \u00b7 '}
                          {profile.schedule.chargingRateUnit}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {profile.chargingProfileKind}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {profile.connectorId === 0
                        ? 'All'
                        : `#${profile.connectorId}`}
                    </span>
                    <clearProfileFetcher.Form method="post">
                      <input
                        type="hidden"
                        name="intent"
                        value="clearChargingProfile"
                      />
                      <input
                        type="hidden"
                        name="chargerId"
                        value={charger.id}
                      />
                      <input
                        type="hidden"
                        name="chargingProfileId"
                        value={profile.chargingProfileId}
                      />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-red-600"
                        aria-label={`Remove profile #${profile.chargingProfileId}`}
                      >
                        <RiDeleteBinLine
                          aria-hidden="true"
                          className="size-3"
                        />
                      </Button>
                    </clearProfileFetcher.Form>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Charging Profile Dialog */}
      <CreateChargingProfileDialog
        open={profileDialogOpen}
        onOpenChange={setProfileDialogOpen}
        chargerId={charger.id}
        connectors={charger.connectors}
      />

      {/* Authorization */}
      <Card>
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold">Authorization</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Local authorization list management
          </p>
          <div className="mt-4 rounded-lg border">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 border-b bg-muted/50 px-3 py-2 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
              <span>ID Tag</span>
              <span>Status</span>
              <span>Expiry</span>
              <span className="sr-only">Actions</span>
            </div>
            <div className="divide-y">
              {visibleAuthList.length === 0 && (
                <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                  No authorization tags configured
                </p>
              )}
              {visibleAuthList.map((auth) => (
                <div
                  key={auth.id}
                  className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 px-3 py-2"
                >
                  <span className="flex items-center gap-2 text-xs font-medium">
                    <RiShieldKeyholeLine
                      aria-hidden="true"
                      className="size-3.5 text-muted-foreground"
                    />
                    {auth.idTag}
                  </span>
                  <Badge
                    className={cn(
                      'text-[10px]',
                      auth.status === 'Accepted'
                        ? 'bg-emerald-500/15 text-emerald-700'
                        : 'bg-red-500/15 text-red-700'
                    )}
                  >
                    {auth.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {auth.expiryDate
                      ? new Date(auth.expiryDate).toLocaleDateString()
                      : '—'}
                  </span>
                  <removeFetcher.Form method="post">
                    <input type="hidden" name="intent" value="removeAuthTag" />
                    <input
                      type="hidden"
                      name="chargerId"
                      value={charger.id}
                    />
                    <input
                      type="hidden"
                      name="authTagId"
                      value={auth.id}
                    />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon"
                      className="size-6"
                    >
                      <RiDeleteBinLine
                        aria-hidden="true"
                        className="size-3.5 text-muted-foreground"
                      />
                      <span className="sr-only">Remove {auth.idTag}</span>
                    </Button>
                  </removeFetcher.Form>
                </div>
              ))}
            </div>
          </div>
          <addFetcher.Form method="post" className="mt-3 flex gap-2">
            <input type="hidden" name="intent" value="addAuthTag" />
            <input type="hidden" name="chargerId" value={charger.id} />
            <Input
              name="idTag"
              className="h-8 text-xs"
              placeholder="Add ID tag..."
              value={newIdTag}
              onChange={(e) => setNewIdTag(e.target.value)}
            />
            <Button
              type="submit"
              size="sm"
              className="h-8"
              disabled={
                addFetcher.state === 'submitting' || !newIdTag.trim()
              }
            >
              <RiAddLine aria-hidden="true" data-icon="inline-start" />
              Add
            </Button>
          </addFetcher.Form>
        </CardContent>
      </Card>

      {/* Firmware */}
      <Card>
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold">Firmware &amp; Diagnostics</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Update firmware and request diagnostic uploads
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-3 rounded-lg border p-4">
              <div className="flex items-center gap-2">
                <RiUploadLine
                  aria-hidden="true"
                  className="size-4 text-muted-foreground"
                />
                <p className="text-xs font-medium">Firmware Update</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Current:</span>
                <span className="font-medium text-foreground">
                  {charger.firmwareVersion}
                </span>
                <Badge className="bg-emerald-500/15 text-[10px] text-emerald-700">
                  {charger.firmwareStatus}
                </Badge>
              </div>
              <Input
                className="h-8 text-xs"
                placeholder="Firmware download URL..."
                value={firmwareUrl}
                onChange={(e) => setFirmwareUrl(e.target.value)}
              />
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={handleFirmwareUpdate}
              >
                <RiUploadLine aria-hidden="true" data-icon="inline-start" />
                Update Firmware
              </Button>
            </div>
            <div className="flex flex-col gap-3 rounded-lg border p-4">
              <div className="flex items-center gap-2">
                <RiSettings3Line
                  aria-hidden="true"
                  className="size-4 text-muted-foreground"
                />
                <p className="text-xs font-medium">Diagnostics</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Status:</span>
                <span className="font-medium text-foreground">
                  {charger.diagnosticsStatus}
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={handleRequestDiagnostics}
              >
                Request Diagnostics Upload
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-200">
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold text-red-700">Danger Zone</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Irreversible actions
          </p>
          <div className="mt-4 flex items-center justify-between rounded-lg border border-red-200 bg-red-50/30 p-4">
            <div>
              <p className="text-sm font-medium">Delete this charger</p>
              <p className="text-xs text-muted-foreground">
                Remove this charger and all its data permanently.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-red-300 text-red-700 hover:bg-red-50"
              onClick={handleDeleteCharger}
            >
              <RiDeleteBinLine aria-hidden="true" data-icon="inline-start" />
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// --- Create Charging Profile Dialog ---

function CreateChargingProfileDialog({
  open,
  onOpenChange,
  chargerId,
  connectors,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  chargerId: string
  connectors: ConnectorDetail[]
}) {
  const profileFetcher = useFetcher()
  const [connectorId, setConnectorId] = useState('0')
  const [profileId, setProfileId] = useState('1')
  const [stackLevel, setStackLevel] = useState('0')
  const [purpose, setPurpose] = useState('TxDefaultProfile')
  const [kind, setKind] = useState('Absolute')
  const [rateUnit, setRateUnit] = useState('W')
  const [limit, setLimit] = useState('')
  const [recurrencyKind, setRecurrencyKind] = useState('')

  const isSubmitting = profileFetcher.state === 'submitting'

  useEffect(() => {
    if (profileFetcher.state === 'idle' && profileFetcher.data?.ok) {
      onOpenChange(false)
      setProfileId('1')
      setStackLevel('0')
      setPurpose('TxDefaultProfile')
      setKind('Absolute')
      setRateUnit('W')
      setLimit('')
      setRecurrencyKind('')
      setConnectorId('0')
    }
  }, [profileFetcher.state, profileFetcher.data])

  const profileJson = JSON.stringify({
    chargingProfileId: parseInt(profileId) || 1,
    stackLevel: parseInt(stackLevel) || 0,
    chargingProfilePurpose: purpose,
    chargingProfileKind: kind,
    recurrencyKind: kind === 'Recurring' ? recurrencyKind || 'Daily' : '',
    chargingSchedule: {
      chargingRateUnit: rateUnit,
      chargingSchedulePeriod: limit
        ? [{ startPeriod: 0, limit: parseFloat(limit), numberPhases: 3 }]
        : [],
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Charging Profile</DialogTitle>
          <DialogDescription>
            Set power limits and time-based charging schedules for this charger.
          </DialogDescription>
        </DialogHeader>
        <profileFetcher.Form
          method="post"
          className="flex flex-col gap-4 py-2"
        >
          <input type="hidden" name="intent" value="setChargingProfile" />
          <input type="hidden" name="chargerId" value={chargerId} />
          <input type="hidden" name="connectorId" value={connectorId} />
          <input type="hidden" name="profileJson" value={profileJson} />

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="cp-connector" className="text-xs">
                Connector
              </Label>
              <select
                id="cp-connector"
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-xs shadow-sm focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                value={connectorId}
                onChange={(e) => setConnectorId(e.target.value)}
              >
                <option value="0">All connectors</option>
                {connectors.map((c) => (
                  <option key={c.id} value={c.id}>
                    Connector #{c.id}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="cp-profile-id" className="text-xs">
                Profile ID
              </Label>
              <Input
                id="cp-profile-id"
                type="number"
                className="text-xs"
                value={profileId}
                onChange={(e) => setProfileId(e.target.value)}
                min={1}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="cp-purpose" className="text-xs">
                Purpose
              </Label>
              <select
                id="cp-purpose"
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-xs shadow-sm focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
              >
                <option value="ChargePointMaxProfile">
                  ChargePointMaxProfile
                </option>
                <option value="TxDefaultProfile">TxDefaultProfile</option>
                <option value="TxProfile">TxProfile</option>
              </select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="cp-kind" className="text-xs">
                Kind
              </Label>
              <select
                id="cp-kind"
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-xs shadow-sm focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
              >
                <option value="Absolute">Absolute</option>
                <option value="Recurring">Recurring</option>
                <option value="Relative">Relative</option>
              </select>
            </div>
          </div>

          {kind === 'Recurring' && (
            <div className="grid gap-1.5">
              <Label htmlFor="cp-recurrency" className="text-xs">
                Recurrency Kind
              </Label>
              <select
                id="cp-recurrency"
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-xs shadow-sm focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                value={recurrencyKind}
                onChange={(e) => setRecurrencyKind(e.target.value)}
              >
                <option value="Daily">Daily</option>
                <option value="Weekly">Weekly</option>
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="cp-rate-unit" className="text-xs">
                Rate Unit
              </Label>
              <select
                id="cp-rate-unit"
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-xs shadow-sm focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                value={rateUnit}
                onChange={(e) => setRateUnit(e.target.value)}
              >
                <option value="W">Watts (W)</option>
                <option value="A">Amps (A)</option>
              </select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="cp-limit" className="text-xs">
                Limit ({rateUnit})
              </Label>
              <Input
                id="cp-limit"
                type="number"
                className="text-xs"
                placeholder={rateUnit === 'W' ? 'e.g. 7400' : 'e.g. 32'}
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                min={0}
                step="0.1"
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="cp-stack" className="text-xs">
              Stack Level
            </Label>
            <Input
              id="cp-stack"
              type="number"
              className="text-xs"
              value={stackLevel}
              onChange={(e) => setStackLevel(e.target.value)}
              min={0}
            />
            <p className="text-[10px] text-muted-foreground">
              Higher stack level takes priority over lower ones
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting || !limit}>
              {isSubmitting && (
                <RiLoader4Line
                  aria-hidden="true"
                  className="size-3.5 animate-spin"
                />
              )}
              Set Profile
            </Button>
          </DialogFooter>
        </profileFetcher.Form>
      </DialogContent>
    </Dialog>
  )
}
