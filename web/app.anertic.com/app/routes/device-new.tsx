import { useState } from 'react'
import { useNavigate } from 'react-router'
import {
  RiArrowLeftLine,
  RiArrowRightSLine,
  RiArrowLeftSLine,
  RiCheckLine,
  RiCpuLine,
  RiSunLine,
  RiPlugLine,
  RiFlashlightLine,
  RiBuildingLine,
  RiStackLine,
  RiDoorOpenLine,
} from '@remixicon/react'
import { toast } from 'sonner'

import useSWR from 'swr'
import { fetcher } from '~/lib/api'
import { useSiteId } from '~/layouts/site'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { cn } from '~/lib/utils'

// --- Types ---

type DeviceType = 'meter' | 'inverter' | 'solar_panel' | 'appliance'
type Step = 'type' | 'details' | 'location'

const STEPS: Step[] = ['type', 'details', 'location']
const STEP_LABELS: Record<Step, string> = {
  type: 'Type',
  details: 'Details',
  location: 'Location',
}

const DEVICE_TYPES: {
  type: DeviceType
  label: string
  icon: typeof RiCpuLine
  color: string
  bg: string
  description: string
  enabled: boolean
}[] = [
  {
    type: 'meter',
    label: 'Energy Meter',
    icon: RiCpuLine,
    color: 'text-cyan-600',
    bg: 'bg-cyan-500/10',
    description: 'Distribution board or circuit meter',
    enabled: true,
  },
  {
    type: 'inverter',
    label: 'Inverter',
    icon: RiFlashlightLine,
    color: 'text-violet-600',
    bg: 'bg-violet-500/10',
    description: 'Solar or hybrid inverter',
    enabled: false,
  },
  {
    type: 'solar_panel',
    label: 'Solar Panel',
    icon: RiSunLine,
    color: 'text-amber-600',
    bg: 'bg-amber-500/10',
    description: 'PV panel or array',
    enabled: false,
  },
  {
    type: 'appliance',
    label: 'Appliance',
    icon: RiPlugLine,
    color: 'text-emerald-600',
    bg: 'bg-emerald-500/10',
    description: 'Individual device or EV charger',
    enabled: false,
  },
]

const DETAIL_HINTS: Record<
  DeviceType,
  { namePlaceholder: string; tagPlaceholder: string; tagHelp: string }
> = {
  meter: {
    namePlaceholder: 'e.g. Building A Main DB',
    tagPlaceholder: 'e.g. Ground floor total consumption',
    tagHelp: 'Describe what this meter measures',
  },
  inverter: {
    namePlaceholder: 'e.g. Huawei SUN2000-10KTL',
    tagPlaceholder: 'e.g. Rooftop array inverter',
    tagHelp: 'Where this inverter is installed',
  },
  solar_panel: {
    namePlaceholder: 'e.g. Rooftop PV Array',
    tagPlaceholder: 'e.g. 20kWp east-facing array',
    tagHelp: 'Panel location or specification',
  },
  appliance: {
    namePlaceholder: 'e.g. Office AC Unit',
    tagPlaceholder: 'e.g. 2nd floor lobby',
    tagHelp: 'Location or purpose of this appliance',
  },
}

// --- Component ---

export default function DeviceNew() {
  const navigate = useNavigate()
  const siteId = useSiteId()

  const [step, setStep] = useState<Step>('type')
  const [selectedType, setSelectedType] = useState<DeviceType | null>(null)
  const [name, setName] = useState('')
  const [tag, setTag] = useState('')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [creating, setCreating] = useState(false)
  const [locationType, setLocationType] = useState<string>('')
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null)
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)

  const stepIndex = STEPS.indexOf(step)
  const hints = selectedType ? DETAIL_HINTS[selectedType] : DETAIL_HINTS.meter

  const canContinue = (() => {
    if (step === 'type') return selectedType !== null
    if (step === 'details') return name.trim() !== ''
    if (step === 'location') return true
    return false
  })()

  async function handleCreate() {
    setCreating(true)
    try {
      const result = await fetcher<{ id: string }>([
        'device.create',
        {
          siteId,
          name: name.trim(),
          type: selectedType,
          tag: tag.trim(),
          brand: brand.trim(),
          model: model.trim(),
        },
      ])
      if (locationType) {
        try {
          await fetcher([
            'device.setLocation',
            {
              siteId,
              deviceId: result.id,
              location: locationType,
              level: selectedLevel,
              roomId: selectedRoomId,
            },
          ])
        } catch {
          // location assignment is non-critical, device is already created
        }
      }
      toast.success(`Device "${name}" created`)
      navigate(`/devices/${result.id}?site=${siteId}`)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to create device'
      )
    } finally {
      setCreating(false)
    }
  }

  function goNext() {
    if (stepIndex < STEPS.length - 1) setStep(STEPS[stepIndex + 1])
  }

  function goBack() {
    if (stepIndex > 0) setStep(STEPS[stepIndex - 1])
  }

  const selectedTypeConfig = selectedType
    ? DEVICE_TYPES.find((t) => t.type === selectedType)
    : null

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Back */}
      <button
        onClick={() => navigate('/devices')}
        className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <RiArrowLeftLine className="size-4" />
        Back to devices
      </button>

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Add Device</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {step === 'type' && 'Select the device type'}
            {step === 'details' && 'Enter device information'}
            {step === 'location' && 'Set where this device is installed (optional)'}
          </p>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          {stepIndex + 1} / {STEPS.length}
        </span>
      </div>

      {/* Progress bar */}
      <div className="flex gap-1.5">
        {STEPS.map((s, i) => (
          <button
            key={s}
            onClick={() => {
              if (i < stepIndex) setStep(s)
            }}
            disabled={i > stepIndex}
            className="group flex-1"
          >
            <div
              className={cn(
                'h-1 rounded-full transition-all duration-500',
                i < stepIndex
                  ? 'bg-foreground'
                  : i === stepIndex
                    ? 'bg-foreground/50'
                    : 'bg-border',
                i < stepIndex && 'cursor-pointer group-hover:bg-foreground/70'
              )}
            />
            <span
              className={cn(
                'mt-1.5 block text-[10px] font-medium text-muted-foreground transition-colors',
                i === stepIndex && 'text-foreground'
              )}
            >
              {STEP_LABELS[s]}
            </span>
          </button>
        ))}
      </div>

      {/* Step: Device Type */}
      {step === 'type' && (
        <div className="animate-in space-y-6 duration-200 fade-in slide-in-from-bottom-1">
          <div className="grid gap-3 sm:grid-cols-2">
            {DEVICE_TYPES.map((config) => {
              const Icon = config.icon
              const isSelected = selectedType === config.type
              const isDisabled = !config.enabled
              return (
                <button
                  key={config.type}
                  onClick={() => !isDisabled && setSelectedType(config.type)}
                  disabled={isDisabled}
                  className={cn(
                    'relative rounded-xl border-2 p-5 text-left transition-all',
                    isDisabled
                      ? 'cursor-not-allowed opacity-40'
                      : isSelected
                        ? 'border-foreground/20 bg-foreground/[0.03] shadow-sm'
                        : 'border-border/50 hover:border-border hover:bg-muted/20'
                  )}
                >
                  {isSelected && (
                    <div className="absolute top-3 right-3">
                      <RiCheckLine className="size-4 text-foreground/40" />
                    </div>
                  )}

                  <div
                    className={cn(
                      'mb-3 flex size-10 items-center justify-center rounded-xl',
                      config.bg
                    )}
                  >
                    <Icon className={cn('size-5', config.color)} />
                  </div>

                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{config.label}</p>
                    {isDisabled && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        Coming soon
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {config.description}
                  </p>
                </button>
              )
            })}
          </div>

          <div className="flex justify-end">
            <Button
              disabled={!canContinue}
              onClick={goNext}
              className="gap-1.5"
            >
              Continue
              <RiArrowRightSLine className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step: Details */}
      {step === 'details' && (
        <div className="animate-in space-y-5 duration-200 fade-in slide-in-from-bottom-1">
          {/* Summary of selection */}
          {selectedTypeConfig && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <selectedTypeConfig.icon
                className={cn('size-3.5', selectedTypeConfig.color)}
              />
              <span className="font-medium text-foreground">
                {selectedTypeConfig.label}
              </span>
            </div>
          )}

          <Card className="border-border/50">
            <CardContent className="space-y-4 p-5">
              <div>
                <Label htmlFor="device-name" className="text-xs">
                  Device Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="device-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={hints.namePlaceholder}
                  className="mt-1.5"
                  autoFocus
                />
              </div>

              <div>
                <Label htmlFor="device-tag" className="text-xs">
                  Tag
                </Label>
                <Input
                  id="device-tag"
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  placeholder={hints.tagPlaceholder}
                  className="mt-1.5"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {hints.tagHelp}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="device-brand" className="text-xs">
                    Brand
                  </Label>
                  <Input
                    id="device-brand"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="e.g. Eastron"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="device-model" className="text-xs">
                    Model
                  </Label>
                  <Input
                    id="device-model"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="e.g. SDM630"
                    className="mt-1.5"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={goBack}
            >
              <RiArrowLeftSLine className="size-4" />
              Back
            </Button>
            <Button
              disabled={!canContinue}
              onClick={goNext}
              className="gap-1.5"
            >
              Continue
              <RiArrowRightSLine className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step: Location */}
      {step === 'location' && (
        <LocationStep
          siteId={siteId}
          locationType={locationType}
          setLocationType={setLocationType}
          selectedLevel={selectedLevel}
          setSelectedLevel={setSelectedLevel}
          selectedRoomId={selectedRoomId}
          setSelectedRoomId={setSelectedRoomId}
          creating={creating}
          onBack={goBack}
          onCreate={handleCreate}
        />
      )}
    </div>
  )
}

interface FloorItem {
  siteId: string
  name: string
  level: number
}

interface RoomItem {
  id: string
  siteId: string
  name: string
  type: string
  level: number
}

function LocationStep({
  siteId,
  locationType,
  setLocationType,
  selectedLevel,
  setSelectedLevel,
  selectedRoomId,
  setSelectedRoomId,
  creating,
  onBack,
  onCreate,
}: {
  siteId: string
  locationType: string
  setLocationType: (v: string) => void
  selectedLevel: number | null
  setSelectedLevel: (v: number | null) => void
  selectedRoomId: string | null
  setSelectedRoomId: (v: string | null) => void
  creating: boolean
  onBack: () => void
  onCreate: () => void
}) {
  const { data: floorsData } = useSWR<{ items: FloorItem[] }>(
    ['floor.list', { siteId }],
    fetcher
  )
  const { data: roomsData } = useSWR<{ items: RoomItem[] }>(
    selectedLevel != null ? ['room.list', { siteId, level: selectedLevel }] : null,
    fetcher
  )

  const floors = floorsData?.items ?? []
  const rooms = roomsData?.items ?? []

  const locationOptions = [
    {
      value: 'site',
      label: 'Site Level',
      description: 'Monitors whole-site parameters',
      icon: RiBuildingLine,
    },
    {
      value: 'floor',
      label: 'Floor',
      description: 'Assigned to a specific floor',
      icon: RiStackLine,
    },
    {
      value: 'room',
      label: 'Room',
      description: 'Assigned to a specific room',
      icon: RiDoorOpenLine,
    },
  ]

  return (
    <div className="animate-in space-y-5 duration-200 fade-in slide-in-from-bottom-1">
      <Card className="border-border/50">
        <CardContent className="space-y-2 p-5">
          {locationOptions.map((opt) => {
            const Icon = opt.icon
            const isSelected = locationType === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => {
                  setLocationType(opt.value)
                  if (opt.value === 'site') {
                    setSelectedLevel(null)
                    setSelectedRoomId(null)
                  }
                }}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all',
                  isSelected
                    ? 'border-foreground/20 bg-foreground/[0.03]'
                    : 'border-border/50 hover:border-border hover:bg-muted/20'
                )}
              >
                <div
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-lg',
                    isSelected ? 'bg-foreground/8' : 'bg-muted/50'
                  )}
                >
                  <Icon
                    className={cn(
                      'size-4',
                      isSelected ? 'text-foreground' : 'text-muted-foreground'
                    )}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{opt.label}</p>
                  <p className="text-xs text-muted-foreground">{opt.description}</p>
                </div>
                <div
                  className={cn(
                    'size-4 shrink-0 rounded-full border-2 transition-all',
                    isSelected
                      ? 'border-foreground bg-foreground'
                      : 'border-border'
                  )}
                />
              </button>
            )
          })}
        </CardContent>
      </Card>

      {(locationType === 'floor' || locationType === 'room') && (
        <Card className="border-border/50">
          <CardContent className="space-y-4 p-5">
            <div>
              <Label className="text-xs">Floor</Label>
              <select
                value={selectedLevel ?? ''}
                onChange={(e) => {
                  const val = e.target.value === '' ? null : Number(e.target.value)
                  setSelectedLevel(val)
                  setSelectedRoomId(null)
                }}
                className="mt-1.5 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
              >
                <option value="">Select a floor</option>
                {floors.map((f) => (
                  <option key={f.level} value={f.level}>
                    Floor {f.level}{f.name ? ` · ${f.name}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {locationType === 'room' && selectedLevel != null && (
              <div>
                <Label className="text-xs">Room</Label>
                <select
                  value={selectedRoomId ?? ''}
                  onChange={(e) => setSelectedRoomId(e.target.value || null)}
                  className="mt-1.5 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <option value="">Select a room</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={onBack}>
          <RiArrowLeftSLine className="size-4" />
          Back
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setLocationType('')
              setSelectedLevel(null)
              setSelectedRoomId(null)
              onCreate()
            }}
            disabled={creating}
          >
            Skip
          </Button>
          <Button
            disabled={creating}
            onClick={onCreate}
            className="gap-1.5"
          >
            <RiCheckLine className="size-4" />
            {creating ? 'Creating…' : 'Create Device'}
          </Button>
        </div>
      </div>
    </div>
  )
}
