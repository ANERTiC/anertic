import { useState, useEffect, useRef, useCallback } from 'react'
import { useFetcher, redirect, useOutletContext } from 'react-router'
import type { Route } from './+types/settings'
import useSWR, { useSWRConfig } from 'swr'
import { toast } from 'sonner'
import {
  RiSettings3Line,
  RiMapPinLine,
  RiTimeLine,
  RiNotification3Line,
  RiMoneyDollarCircleLine,
  RiShieldLine,
  RiDeleteBinLine,
  RiCheckLine,
  RiEditLine,
  RiAlertLine,
  RiSunLine,
  RiMoonLine,
  RiGlobalLine,
  RiMailLine,
  RiSmartphoneLine,
  RiKeyLine,
  RiFileCopyLine,
  RiRefreshLine,
  RiEyeLine,
  RiEyeOffLine,
  RiTeamLine,
  RiUserAddLine,
  RiCloseLine,
  RiMore2Line,
  RiArrowDownSLine,
  RiUserUnfollowLine,
  RiSendPlaneLine,
} from '@remixicon/react'
import { useSiteId } from '~/layouts/site'
import { Card, CardContent } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Badge } from '~/components/ui/badge'
import { Separator } from '~/components/ui/separator'
import { cn } from '~/lib/utils'
import { fetcher } from '~/lib/api'
import type { User } from '~/layouts/console'
import { Skeleton } from '~/components/ui/skeleton'

// --- Types ---

interface SiteSettings {
  name: string
  address: string
  latitude: number
  longitude: number
  timezone: string
  currency: string
  // Tariffs
  gridImportRate: number
  gridExportRate: number
  touEnabled: boolean
  peakStartHour: number
  peakEndHour: number
  peakRate: number
  offPeakRate: number
  // Notifications
  emailAlerts: boolean
  pushAlerts: boolean
  alertOffline: boolean
  alertFault: boolean
  alertHighConsumption: boolean
  alertLowSolar: boolean
  offlineThresholdMinutes: number
  consumptionThresholdKwh: number
  // API
  webhookUrl: string
  // Meta
  createdAt: string
  updatedAt: string
}

type MemberRole = '*' | 'editor' | 'viewer'

interface SiteMember {
  userId: string
  name: string
  email: string
  picture: string
  role: MemberRole
  joinedAt: string
}

interface PendingInvite {
  id: string
  email: string
  role: MemberRole
  status: string
  expiresAt: string
  createdAt: string
}

const ROLE_CONFIG: Record<
  MemberRole,
  { label: string; color: string; description: string }
> = {
  '*': {
    label: 'Owner',
    color: 'bg-amber-500/15 text-amber-700',
    description: 'Full access, can delete site',
  },
  editor: {
    label: 'Editor',
    color: 'bg-blue-500/15 text-blue-700',
    description: 'Edit devices and chargers',
  },
  viewer: {
    label: 'Viewer',
    color: 'bg-muted text-muted-foreground',
    description: 'View-only access',
  },
}

// --- Toggle Switch ---

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200',
        checked ? 'bg-primary' : 'bg-muted-foreground/25'
      )}
    >
      <span
        className={cn(
          'pointer-events-none block size-3.5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200',
          checked ? 'translate-x-[1.125rem]' : 'translate-x-[0.175rem]'
        )}
      />
    </button>
  )
}

// --- Section Header ---

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof RiSettings3Line
  title: string
  description: string
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

// --- Action ---

export async function clientAction({ request }: Route.ClientActionArgs) {
  const formData = await request.formData()
  const intent = formData.get('intent')

  if (intent === 'delete') {
    const siteId = formData.get('siteId') as string
    await fetcher(['site.delete', { id: siteId }])
    return redirect('/')
  }

  throw new Response('Invalid intent', { status: 400 })
}

// --- Main Component ---

export default function Settings() {
  const { mutate: globalMutate } = useSWRConfig()
  const deleteFetcher = useFetcher()
  const siteId = useSiteId()
  const { user: currentUser } = useOutletContext<{
    siteId: string
    user: User
  }>()
  const [mounted, setMounted] = useState(false)
  const [settings, setSettings] = useState<SiteSettings>({
    name: '',
    address: '',
    latitude: 0,
    longitude: 0,
    timezone: '',
    currency: '',
    gridImportRate: 0,
    gridExportRate: 0,
    touEnabled: false,
    peakStartHour: 9,
    peakEndHour: 22,
    peakRate: 0,
    offPeakRate: 0,
    emailAlerts: true,
    pushAlerts: true,
    alertOffline: true,
    alertFault: true,
    alertHighConsumption: true,
    alertLowSolar: false,
    offlineThresholdMinutes: 30,
    consumptionThresholdKwh: 50,
    webhookUrl: '',
    createdAt: '',
    updatedAt: '',
  })
  const [showApiKey, setShowApiKey] = useState(false)
  const [copiedKey, setCopiedKey] = useState(false)
  const [generatedApiKey, setGeneratedApiKey] = useState<string | null>(null)
  const [regenerating, setRegenerating] = useState(false)
  const [editingGeneral, setEditingGeneral] = useState(false)
  const [savingGeneral, setSavingGeneral] = useState(false)
  const [savingTariffs, setSavingTariffs] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const deletingSite = deleteFetcher.state !== 'idle'
  const [members, setMembers] = useState<SiteMember[]>([])
  const [invites, setInvites] = useState<PendingInvite[]>([])
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<MemberRole>('viewer')
  const [roleDropdownOpen, setRoleDropdownOpen] = useState<string | null>(null)
  const [memberMenuOpen, setMemberMenuOpen] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)

  // Fetch site data
  const {
    data: siteData,
    isLoading: isLoadingSite,
    mutate: mutateSite,
  } = useSWR<any>(siteId ? ['site.get', { id: siteId }] : null, fetcher)

  // Fetch members
  const { data: membersData, mutate: mutateMembers } = useSWR<{
    items: SiteMember[]
  }>(siteId ? ['site.listMembers', { siteId }] : null, fetcher)

  // Fetch invites
  const { data: invitesData, mutate: mutateInvites } = useSWR<{
    items: PendingInvite[]
  }>(siteId ? ['site.listInvites', { siteId }] : null, fetcher)

  // Fetch API key status
  const { data: apiKeyData, mutate: mutateApiKey } = useSWR<{
    hasKey: boolean
    createdAt: string | null
  }>(siteId ? ['site.getApiKey', { siteId }] : null, fetcher)

  // Sync site data to settings state
  useEffect(() => {
    if (siteData) {
      setSettings((prev) => ({
        ...prev,
        name: siteData.name || prev.name,
        address: siteData.address || prev.address,
        latitude: siteData.latitude ?? prev.latitude,
        longitude: siteData.longitude ?? prev.longitude,
        timezone: siteData.timezone || prev.timezone,
        currency: siteData.currency || prev.currency,
        gridImportRate: Number(siteData.gridImportRate) || 0,
        gridExportRate: Number(siteData.gridExportRate) || 0,
        peakStartHour: siteData.peakStartHour ?? prev.peakStartHour,
        peakEndHour: siteData.peakEndHour ?? prev.peakEndHour,
        peakRate: Number(siteData.peakRate) || 0,
        offPeakRate: Number(siteData.offPeakRate) || 0,
      }))
    }
  }, [siteData])

  // Sync members data
  useEffect(() => {
    if (membersData?.items) {
      setMembers(
        membersData.items.map((m: any) => ({
          ...m,
          joinedAt: m.createdAt,
        }))
      )
    }
  }, [membersData])

  // Sync invites data
  useEffect(() => {
    if (invitesData?.items) {
      setInvites(invitesData.items)
    }
  }, [invitesData])

  useEffect(() => {
    setMounted(true)
  }, [])

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (!target.closest('[data-dropdown]')) {
        setRoleDropdownOpen(null)
        setMemberMenuOpen(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function update<K extends keyof SiteSettings>(
    key: K,
    value: SiteSettings[K]
  ) {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSaveGeneral() {
    setSavingGeneral(true)
    try {
      await fetcher([
        'site.update',
        {
          id: siteId,
          name: settings.name,
          address: settings.address,
          latitude: settings.latitude,
          longitude: settings.longitude,
          timezone: settings.timezone,
          currency: settings.currency,
        },
      ])
      toast.success('Site settings saved')
      setEditingGeneral(false)
      mutateSite()
      globalMutate(['site.list', ''])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSavingGeneral(false)
    }
  }

  async function handleSaveTariffs() {
    setSavingTariffs(true)
    try {
      await fetcher([
        'site.updateTariff',
        {
          id: siteId,
          gridImportRate: settings.gridImportRate,
          gridExportRate: settings.gridExportRate,
          peakStartHour: settings.peakStartHour,
          peakEndHour: settings.peakEndHour,
          peakRate: settings.peakRate,
          offPeakRate: settings.offPeakRate,
        },
      ])
      toast.success('Tariff settings saved')
      mutateSite()
      globalMutate(['site.list', ''])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSavingTariffs(false)
    }
  }

  function handleInvite() {
    if (!inviteEmail.trim()) return
    fetcher([
      'site.inviteMember',
      { siteId, email: inviteEmail.trim(), role: inviteRole },
    ])
      .then(() => {
        toast.success('Invitation sent')
        setInviteEmail('')
        setInviteRole('viewer')
        setShowInviteForm(false)
        mutateInvites()
      })
      .catch((err) => {
        toast.error(
          err instanceof Error ? err.message : 'Failed to send invitation'
        )
      })
  }

  function handleRevokeInvite(id: string) {
    fetcher(['site.revokeInvite', { id }])
      .then(() => {
        toast.success('Invitation revoked')
        mutateInvites()
      })
      .catch((err) => {
        toast.error(
          err instanceof Error ? err.message : 'Failed to revoke invitation'
        )
      })
  }

  function handleChangeMemberRole(userId: string, role: MemberRole) {
    fetcher(['site.updateMemberRole', { siteId, userId, role }])
      .then(() => {
        toast.success('Role updated')
        mutateMembers()
      })
      .catch((err) => {
        toast.error(
          err instanceof Error ? err.message : 'Failed to update role'
        )
      })
    setRoleDropdownOpen(null)
  }

  function handleRemoveMember(userId: string) {
    fetcher(['site.removeMember', { siteId, userId }])
      .then(() => {
        toast.success('Member removed')
        mutateMembers()
      })
      .catch((err) => {
        toast.error(
          err instanceof Error ? err.message : 'Failed to remove member'
        )
      })
    setConfirmRemove(null)
    setMemberMenuOpen(null)
  }

  function handleCopyApiKey() {
    if (!generatedApiKey) return
    navigator.clipboard.writeText(generatedApiKey)
    setCopiedKey(true)
    setTimeout(() => setCopiedKey(false), 2000)
  }

  async function handleRegenerateApiKey() {
    setRegenerating(true)
    try {
      const result = await fetcher<{ apiKey: string }>([
        'site.regenerateApiKey',
        {
          siteId,
        },
      ])
      setGeneratedApiKey(result.apiKey)
      setShowApiKey(true)
      mutateApiKey()
      toast.success('API key regenerated')
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to regenerate API key'
      )
    } finally {
      setRegenerating(false)
    }
  }

  return (
    <div
      className={cn(
        'mx-auto max-w-3xl space-y-8 pb-16 transition-opacity duration-500',
        mounted ? 'opacity-100' : 'opacity-0'
      )}
    >
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Site Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure your site preferences, energy tariffs, and integrations.
        </p>
      </div>

      {/* ──────────────────────────────
          GENERAL
          ────────────────────────────── */}
      <Card className="py-0">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <SectionHeader
              icon={RiMapPinLine}
              title="General"
              description="Site identity and location"
            />
            {!isLoadingSite && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => setEditingGeneral(!editingGeneral)}
              >
                <RiEditLine className="size-3.5" />
                {editingGeneral ? 'Done' : 'Edit'}
              </Button>
            )}
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Site Name</Label>
              {isLoadingSite ? (
                <Skeleton className="h-5 w-32" />
              ) : editingGeneral ? (
                <Input
                  value={settings.name}
                  onChange={(e) => update('name', e.target.value)}
                />
              ) : (
                <p className="text-sm font-medium">{settings.name}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Timezone</Label>
              {isLoadingSite ? (
                <Skeleton className="h-5 w-28" />
              ) : editingGeneral ? (
                <Input
                  value={settings.timezone}
                  onChange={(e) => update('timezone', e.target.value)}
                />
              ) : (
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <RiGlobalLine className="size-3.5 text-muted-foreground" />
                  {settings.timezone}
                </p>
              )}
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs text-muted-foreground">Address</Label>
              {isLoadingSite ? (
                <Skeleton className="h-5 w-72" />
              ) : editingGeneral ? (
                <Input
                  value={settings.address}
                  onChange={(e) => update('address', e.target.value)}
                />
              ) : (
                <p className="text-sm font-medium">{settings.address}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Currency</Label>
              {isLoadingSite ? (
                <Skeleton className="h-5 w-12" />
              ) : editingGeneral ? (
                <Input
                  value={settings.currency}
                  onChange={(e) => update('currency', e.target.value)}
                />
              ) : (
                <p className="text-sm font-medium">
                  {settings.currency || 'THB'}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Site ID</Label>
              <p className="font-mono text-xs text-muted-foreground">
                {siteId}
              </p>
            </div>
          </div>

          {editingGeneral && (
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingGeneral(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={handleSaveGeneral}
                disabled={savingGeneral}
              >
                <RiCheckLine className="size-3.5" />
                {savingGeneral ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ──────────────────────────────
          ENERGY TARIFFS
          ────────────────────────────── */}
      <Card className="py-0">
        <CardContent className="p-6">
          <SectionHeader
            icon={RiMoneyDollarCircleLine}
            title="Energy Tariffs"
            description="Configure electricity rates for cost calculations"
          />

          <div className="mt-6 space-y-5">
            {/* Base Rates */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Grid Import Rate ({settings.currency || '—'}/kWh)
                </Label>
                {isLoadingSite ? (
                  <Skeleton className="h-8 w-full rounded-lg" />
                ) : (
                  <Input
                    type="number"
                    step="0.01"
                    value={settings.gridImportRate}
                    onChange={(e) =>
                      update('gridImportRate', parseFloat(e.target.value) || 0)
                    }
                  />
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Grid Export Rate ({settings.currency || '—'}/kWh)
                </Label>
                {isLoadingSite ? (
                  <Skeleton className="h-8 w-full rounded-lg" />
                ) : (
                  <Input
                    type="number"
                    step="0.01"
                    value={settings.gridExportRate}
                    onChange={(e) =>
                      update('gridExportRate', parseFloat(e.target.value) || 0)
                    }
                  />
                )}
              </div>
            </div>

            <Separator />

            {/* TOU Rates — optional */}
            {isLoadingSite ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-5 w-9 rounded-full" />
                </div>
                <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 px-4 py-5">
                  <div className="flex items-start gap-3">
                    <Skeleton className="size-8 shrink-0 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-3/4" />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                      Time-of-Use Rates
                    </h4>
                    <Badge variant="outline" className="text-[10px]">
                      TOU
                    </Badge>
                  </div>
                  <Toggle
                    checked={settings.touEnabled}
                    onChange={(v) => update('touEnabled', v)}
                  />
                </div>

                {settings.touEnabled ? (
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-lg border bg-amber-500/5 p-4">
                      <div className="flex items-center gap-2">
                        <RiSunLine className="size-4 text-amber-500" />
                        <span className="text-xs font-medium">Peak</span>
                      </div>
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Hours</span>
                          <span className="font-medium tabular-nums">
                            {String(settings.peakStartHour).padStart(2, '0')}:00
                            – {String(settings.peakEndHour).padStart(2, '0')}:00
                          </span>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">
                            Rate ({settings.currency}/kWh)
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={settings.peakRate}
                            onChange={(e) =>
                              update(
                                'peakRate',
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="rounded-lg border bg-blue-500/5 p-4">
                      <div className="flex items-center gap-2">
                        <RiMoonLine className="size-4 text-blue-500" />
                        <span className="text-xs font-medium">Off-Peak</span>
                      </div>
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Hours</span>
                          <span className="font-medium tabular-nums">
                            {String(settings.peakEndHour).padStart(2, '0')}:00 –{' '}
                            {String(settings.peakStartHour).padStart(2, '0')}:00
                          </span>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">
                            Rate ({settings.currency}/kWh)
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={settings.offPeakRate}
                            onChange={(e) =>
                              update(
                                'offPeakRate',
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 rounded-lg border border-dashed border-border/60 bg-muted/20 px-4 py-5">
                    <div className="flex items-start gap-3">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <RiTimeLine className="size-4 text-muted-foreground/60" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          No TOU meter configured
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground/60">
                          Enable this if your site has a Time-of-Use meter with
                          different peak and off-peak electricity rates. This
                          helps calculate more accurate energy costs.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {isLoadingSite ? (
              <div className="flex justify-end">
                <Skeleton className="h-8 w-28 rounded-md" />
              </div>
            ) : (
              <div className="flex justify-end">
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={handleSaveTariffs}
                  disabled={savingTariffs}
                >
                  <RiCheckLine className="size-3.5" />
                  {savingTariffs ? 'Saving...' : 'Save Tariffs'}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ──────────────────────────────
          NOTIFICATIONS
          ────────────────────────────── */}
      <Card className="py-0">
        <CardContent className="p-6">
          <SectionHeader
            icon={RiNotification3Line}
            title="Notifications"
            description="Choose how and when you want to be alerted"
          />

          <div className="mt-6 space-y-5">
            {/* Channels */}
            <div>
              <h4 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Channels
              </h4>
              <div className="mt-3 space-y-3">
                <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                  <div className="flex items-center gap-3">
                    <RiMailLine className="size-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Email</p>
                      <p className="text-xs text-muted-foreground">
                        Receive alerts via email
                      </p>
                    </div>
                  </div>
                  <Toggle
                    checked={settings.emailAlerts}
                    onChange={(v) => update('emailAlerts', v)}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                  <div className="flex items-center gap-3">
                    <RiSmartphoneLine className="size-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Push</p>
                      <p className="text-xs text-muted-foreground">
                        Browser and mobile push notifications
                      </p>
                    </div>
                  </div>
                  <Toggle
                    checked={settings.pushAlerts}
                    onChange={(v) => update('pushAlerts', v)}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Alert Types */}
            <div>
              <h4 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Alert Types
              </h4>
              <div className="mt-3 space-y-1">
                <AlertToggle
                  label="Device Offline"
                  description={`Alert when a device is unreachable for ${settings.offlineThresholdMinutes} min`}
                  checked={settings.alertOffline}
                  onChange={(v) => update('alertOffline', v)}
                />
                <AlertToggle
                  label="Charger Fault"
                  description="Alert when a charger reports a fault status"
                  checked={settings.alertFault}
                  onChange={(v) => update('alertFault', v)}
                />
                <AlertToggle
                  label="High Consumption"
                  description={`Alert when daily consumption exceeds ${settings.consumptionThresholdKwh} kWh`}
                  checked={settings.alertHighConsumption}
                  onChange={(v) => update('alertHighConsumption', v)}
                />
                <AlertToggle
                  label="Low Solar Output"
                  description="Alert when solar production drops below expected levels"
                  checked={settings.alertLowSolar}
                  onChange={(v) => update('alertLowSolar', v)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ──────────────────────────────
          MEMBERS
          ────────────────────────────── */}
      <Card className="py-0">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <SectionHeader
              icon={RiTeamLine}
              title="Members"
              description="Manage who has access to this site"
            />
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => setShowInviteForm(!showInviteForm)}
            >
              {showInviteForm ? (
                <>
                  <RiCloseLine className="size-3.5" />
                  Cancel
                </>
              ) : (
                <>
                  <RiUserAddLine className="size-3.5" />
                  Invite
                </>
              )}
            </Button>
          </div>

          {/* Invite Form */}
          {showInviteForm && (
            <div className="mt-5 rounded-lg border border-dashed border-primary/30 bg-primary/[0.03] p-4">
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="flex-1 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Email address
                  </Label>
                  <Input
                    type="email"
                    placeholder="colleague@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                  />
                </div>
                <div className="w-full space-y-1.5 sm:w-36">
                  <Label className="text-xs text-muted-foreground">Role</Label>
                  <div className="relative" data-dropdown>
                    <button
                      onClick={() =>
                        setRoleDropdownOpen(
                          roleDropdownOpen === 'invite' ? null : 'invite'
                        )
                      }
                      className="flex h-9 w-full items-center justify-between rounded-md border bg-background px-3 text-sm"
                    >
                      <span>{ROLE_CONFIG[inviteRole].label}</span>
                      <RiArrowDownSLine className="size-4 text-muted-foreground" />
                    </button>
                    {roleDropdownOpen === 'invite' && (
                      <div className="absolute top-10 right-0 left-0 z-20 rounded-lg border bg-background p-1 shadow-lg">
                        {(['editor', 'viewer'] as MemberRole[]).map((r) => (
                          <button
                            key={r}
                            onClick={() => {
                              setInviteRole(r)
                              setRoleDropdownOpen(null)
                            }}
                            className="flex w-full flex-col items-start rounded-md px-3 py-2 text-left transition-colors hover:bg-muted"
                          >
                            <span className="text-sm font-medium">
                              {ROLE_CONFIG[r].label}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {ROLE_CONFIG[r].description}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-end">
                  <Button size="sm" className="gap-1.5" onClick={handleInvite}>
                    <RiSendPlaneLine className="size-3.5" />
                    Send Invite
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Pending Invites */}
          {invites.length > 0 && (
            <div className="mt-5">
              <h4 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Pending Invitations
              </h4>
              <div className="mt-2 space-y-1">
                {invites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between rounded-lg px-4 py-2.5 transition-colors hover:bg-muted/30"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex size-8 items-center justify-center rounded-full border border-dashed border-muted-foreground/30">
                        <RiMailLine className="size-3.5 text-muted-foreground/50" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {invite.email}
                        </p>
                        <p className="text-[10px] text-muted-foreground/60">
                          Invited{' '}
                          {new Date(invite.createdAt).toLocaleDateString(
                            'en-US',
                            { month: 'short', day: 'numeric' }
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-medium',
                          ROLE_CONFIG[invite.role].color
                        )}
                      >
                        {ROLE_CONFIG[invite.role].label}
                      </span>
                      <button
                        onClick={() => handleRevokeInvite(invite.id)}
                        className="rounded p-1 text-muted-foreground/40 transition-colors hover:bg-red-500/10 hover:text-red-500"
                        title="Revoke invite"
                      >
                        <RiCloseLine className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <Separator className="mt-3" />
            </div>
          )}

          {/* Member List */}
          <div className="mt-5 space-y-1">
            {members.map((member) => {
              const isOwner = member.role === '*'
              const isSelf = member.userId === currentUser?.id
              const canRemove = !isOwner && !isSelf
              const initials = member.name
                .split(' ')
                .map((w) => w[0])
                .join('')
                .toUpperCase()
                .slice(0, 2)

              return (
                <div
                  key={member.userId}
                  className="group relative flex items-center justify-between rounded-lg px-4 py-3 transition-colors hover:bg-muted/30"
                >
                  <div className="flex items-center gap-3">
                    {member.picture ? (
                      <img
                        src={member.picture}
                        alt={member.name}
                        className="size-9 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex size-9 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                        {initials}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{member.name}</p>
                        {isOwner && (
                          <span className="rounded bg-amber-500/10 px-1.5 py-px text-[9px] font-semibold text-amber-600">
                            OWNER
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {member.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Role selector (not for owner) */}
                    {!isOwner ? (
                      <div className="relative" data-dropdown>
                        <button
                          onClick={() => {
                            setMemberMenuOpen(null)
                            setRoleDropdownOpen(
                              roleDropdownOpen === member.userId
                                ? null
                                : member.userId
                            )
                          }}
                          className={cn(
                            'flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
                            ROLE_CONFIG[member.role].color,
                            'hover:opacity-80'
                          )}
                        >
                          {ROLE_CONFIG[member.role].label}
                          <RiArrowDownSLine className="size-3" />
                        </button>
                        {roleDropdownOpen === member.userId && (
                          <div className="absolute top-8 right-0 z-20 w-48 rounded-lg border bg-background p-1 shadow-lg">
                            {(['editor', 'viewer'] as MemberRole[]).map((r) => (
                              <button
                                key={r}
                                onClick={() =>
                                  handleChangeMemberRole(member.userId, r)
                                }
                                className={cn(
                                  'flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted',
                                  r === member.role && 'bg-muted'
                                )}
                              >
                                <span>{ROLE_CONFIG[r].label}</span>
                                {r === member.role && (
                                  <RiCheckLine className="size-3.5 text-primary" />
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span
                        className={cn(
                          'rounded-full px-2.5 py-1 text-[11px] font-medium',
                          ROLE_CONFIG['*'].color
                        )}
                      >
                        {ROLE_CONFIG['*'].label}
                      </span>
                    )}

                    {/* Actions menu */}
                    <div className="relative" data-dropdown>
                      <button
                        onClick={() => {
                          setRoleDropdownOpen(null)
                          setConfirmRemove(null)
                          setMemberMenuOpen(
                            memberMenuOpen === member.userId
                              ? null
                              : member.userId
                          )
                        }}
                        className="rounded p-1 text-muted-foreground/40 opacity-0 transition-all group-hover:opacity-100 hover:bg-muted hover:text-muted-foreground"
                      >
                        <RiMore2Line className="size-4" />
                      </button>
                      {memberMenuOpen === member.userId && (
                        <div className="absolute top-8 right-0 z-20 w-44 rounded-lg border bg-background p-1 shadow-lg">
                          {confirmRemove === member.userId ? (
                            <div className="space-y-1 p-2">
                              <p className="text-xs font-medium text-red-600">
                                Remove this member?
                              </p>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 flex-1 text-xs"
                                  onClick={() => {
                                    setConfirmRemove(null)
                                    setMemberMenuOpen(null)
                                  }}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="h-7 flex-1 text-xs"
                                  onClick={() =>
                                    handleRemoveMember(member.userId)
                                  }
                                >
                                  Remove
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() =>
                                canRemove && setConfirmRemove(member.userId)
                              }
                              disabled={!canRemove}
                              className={cn(
                                'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                                canRemove
                                  ? 'text-red-600 hover:bg-red-500/10'
                                  : 'cursor-not-allowed text-muted-foreground/40'
                              )}
                            >
                              <RiUserUnfollowLine className="size-3.5" />
                              Remove member
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Member count footer */}
          <div className="mt-4 flex items-center justify-between border-t pt-3 text-[10px] text-muted-foreground/60">
            <span>
              {members.length} member{members.length !== 1 && 's'}
              {invites.length > 0 && ` · ${invites.length} pending`}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ──────────────────────────────
          API & INTEGRATIONS
          ────────────────────────────── */}
      <Card className="py-0">
        <CardContent className="p-6">
          <SectionHeader
            icon={RiKeyLine}
            title="API & Integrations"
            description="Manage API access and webhook endpoints"
          />

          <div className="mt-6 space-y-5">
            {/* API Key */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">API Key</Label>
              {generatedApiKey ? (
                <>
                  <div className="rounded-lg border border-amber-200/50 bg-amber-500/5 p-3">
                    <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-amber-700">
                      <RiAlertLine className="size-3.5" />
                      Copy this key now — it won't be shown again
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex flex-1 items-center rounded-md border bg-muted/30 px-3 py-2">
                        <code className="flex-1 font-mono text-xs">
                          {showApiKey
                            ? generatedApiKey
                            : 'anr_' + '•'.repeat(32)}
                        </code>
                        <button
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="ml-2 text-muted-foreground transition-colors hover:text-foreground"
                        >
                          {showApiKey ? (
                            <RiEyeOffLine className="size-3.5" />
                          ) : (
                            <RiEyeLine className="size-3.5" />
                          )}
                        </button>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs"
                        onClick={handleCopyApiKey}
                      >
                        {copiedKey ? (
                          <RiCheckLine className="size-3.5 text-emerald-500" />
                        ) : (
                          <RiFileCopyLine className="size-3.5" />
                        )}
                        {copiedKey ? 'Copied' : 'Copy'}
                      </Button>
                    </div>
                  </div>
                </>
              ) : apiKeyData?.hasKey ? (
                <div className="flex items-center gap-2">
                  <div className="flex flex-1 items-center rounded-md border bg-muted/30 px-3 py-2">
                    <code className="flex-1 font-mono text-xs text-muted-foreground">
                      anr_{'•'.repeat(32)}
                    </code>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={handleRegenerateApiKey}
                    disabled={regenerating}
                  >
                    <RiRefreshLine
                      className={cn('size-3.5', regenerating && 'animate-spin')}
                    />
                    {regenerating ? 'Regenerating...' : 'Regenerate'}
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="flex flex-1 items-center rounded-md border border-dashed bg-muted/10 px-3 py-2">
                    <span className="text-xs text-muted-foreground">
                      No API key generated
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={handleRegenerateApiKey}
                    disabled={regenerating}
                  >
                    <RiKeyLine
                      className={cn('size-3.5', regenerating && 'animate-spin')}
                    />
                    {regenerating ? 'Generating...' : 'Generate Key'}
                  </Button>
                </div>
              )}
              <p className="text-[10px] text-muted-foreground">
                {apiKeyData?.hasKey && apiKeyData.createdAt
                  ? `Key created ${new Date(apiKeyData.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`
                  : 'Use this key to authenticate meter data ingestion for this site.'}
              </p>
            </div>

            <Separator />

            {/* Webhook */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Webhook URL
              </Label>
              <Input
                placeholder="https://example.com/webhooks/anertic"
                value={settings.webhookUrl}
                onChange={(e) => update('webhookUrl', e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground">
                We'll send POST requests with event payloads to this URL.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ──────────────────────────────
          METADATA
          ────────────────────────────── */}
      <div className="flex items-center justify-between rounded-lg border border-dashed px-4 py-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <RiTimeLine className="size-3.5" />
            Created{' '}
            {new Date(settings.createdAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </span>
          <span>
            Last updated{' '}
            {new Date(settings.updatedAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </span>
        </div>
      </div>

      {/* ──────────────────────────────
          DANGER ZONE
          ────────────────────────────── */}
      {members.some((m) => m.userId === currentUser?.id && m.role === '*') && (
        <Card className="border-red-200/50 py-0">
          <CardContent className="p-6">
            <SectionHeader
              icon={RiShieldLine}
              title="Danger Zone"
              description="Irreversible actions that affect your site"
            />

            <div className="mt-6 flex items-center justify-between rounded-lg border border-red-200/50 bg-red-500/5 px-4 py-3">
              <div>
                <p className="text-sm font-medium">Delete this site</p>
                <p className="text-xs text-muted-foreground">
                  Permanently remove this site, all devices, and historical
                  data. This cannot be undone.
                </p>
              </div>
              {showDeleteConfirm ? (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(false)}
                  >
                    Cancel
                  </Button>
                  <deleteFetcher.Form method="post">
                    <input type="hidden" name="intent" value="delete" />
                    <input type="hidden" name="siteId" value={siteId} />
                    <Button
                      type="submit"
                      variant="destructive"
                      size="sm"
                      className="gap-1.5"
                      disabled={deletingSite}
                    >
                      <RiDeleteBinLine className="size-3.5" />
                      {deletingSite ? 'Deleting…' : 'Confirm Delete'}
                    </Button>
                  </deleteFetcher.Form>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <RiAlertLine className="size-3.5" />
                  Delete Site
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// --- Sub-components ---

function AlertToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between rounded-lg px-4 py-3 transition-colors hover:bg-muted/30">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  )
}
