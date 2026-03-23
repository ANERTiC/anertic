import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { RiAddLine, RiArrowRightLine, RiBuilding2Line, RiMapPinLine, RiSearchLine } from '@remixicon/react'
import { toast } from 'sonner'
import useSWR from 'swr'

import { fetcher } from '~/lib/api'
import { setCookie } from '~/lib/cookie'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Skeleton } from '~/components/ui/skeleton'
import { cn } from '~/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog'

interface Site {
  id: string
  name: string
  address: string
  timezone: string
  createdAt: string
}

interface ListResult {
  items: Site[]
}

interface CreateResult {
  id: string
}

const SITE_ACCENTS = [
  { bg: "bg-amber-500/10", text: "text-amber-600", ring: "ring-amber-500/20", dot: "bg-amber-500" },
  { bg: "bg-emerald-500/10", text: "text-emerald-600", ring: "ring-emerald-500/20", dot: "bg-emerald-500" },
  { bg: "bg-cyan-500/10", text: "text-cyan-600", ring: "ring-cyan-500/20", dot: "bg-cyan-500" },
  { bg: "bg-violet-500/10", text: "text-violet-600", ring: "ring-violet-500/20", dot: "bg-violet-500" },
  { bg: "bg-rose-500/10", text: "text-rose-600", ring: "ring-rose-500/20", dot: "bg-rose-500" },
  { bg: "bg-blue-500/10", text: "text-blue-600", ring: "ring-blue-500/20", dot: "bg-blue-500" },
  { bg: "bg-teal-500/10", text: "text-teal-600", ring: "ring-teal-500/20", dot: "bg-teal-500" },
  { bg: "bg-orange-500/10", text: "text-orange-600", ring: "ring-orange-500/20", dot: "bg-orange-500" },
]

function getSiteAccent(index: number) {
  return SITE_ACCENTS[index % SITE_ACCENTS.length]
}

const timezones = Intl.supportedValuesOf('timeZone')

export default function Sites() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const search = searchParams.get('q') || ''
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [timezone, setTimezone] = useState('Asia/Bangkok')

  const { data, isLoading, mutate } = useSWR<ListResult>(
    ['site.list', { search }],
    fetcher,
    {
      onError(err) {
        toast.error(err instanceof Error ? err.message : 'Failed to load sites')
      },
    }
  )

  const sites = data?.items || []

  function resetForm() {
    setName('')
    setAddress('')
    setTimezone('Asia/Bangkok')
  }

  function handleOpenChange(value: boolean) {
    setOpen(value)
    if (!value) {
      resetForm()
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    try {
      const result = await fetcher<CreateResult>(['site.create', {
        name,
        address,
        timezone,
      }])
      toast.success('Site created successfully')
      setOpen(false)
      resetForm()
      setCookie("anertic_current_site", result.id)
      navigate(`/chargers?site=${result.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create site')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Sites</h1>
          <p className="text-sm text-muted-foreground">
            Manage your energy monitoring sites
          </p>
        </div>
        <Button onClick={() => navigate("/sites/create")}>
          <RiAddLine className="mr-2 h-4 w-4" />
          New Site
        </Button>
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <span className="hidden" />
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle>Create Site</DialogTitle>
                <DialogDescription>
                  Add a new energy monitoring site to your account.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    placeholder="My Home"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    placeholder="123 Main St"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <select
                    id="timezone"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                  >
                    {timezones.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={creating}>
                  {creating ? 'Creating...' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <RiSearchLine className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search sites..."
          className="pl-9"
          defaultValue={search}
          onChange={(e) => {
            const v = e.target.value
            setSearchParams(prev => {
              if (v) {
                prev.set('q', v)
              } else {
                prev.delete('q')
              }
              return prev
            }, { replace: true })
          }}
        />
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : sites.length === 0 ? (
        <button
          onClick={() => navigate("/sites/create")}
          className="group flex w-full items-center gap-5 rounded-xl border-2 border-dashed border-border/60 p-6 text-left transition-all hover:border-primary/30 hover:bg-primary/5"
        >
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-muted transition-colors group-hover:bg-primary/10">
            <RiBuilding2Line className="size-6 text-muted-foreground transition-colors group-hover:text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">
              {search ? 'No sites found' : 'Create your first site'}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {search
                ? 'Try a different search term'
                : 'Add a location to start monitoring energy production, consumption, and EV charging.'}
            </p>
          </div>
          {!search && (
            <RiArrowRightLine className="ml-auto size-5 text-muted-foreground/40 transition-all group-hover:translate-x-1 group-hover:text-primary" />
          )}
        </button>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sites.map((site, index) => {
            const accent = getSiteAccent(index)
            return (
              <button
                key={site.id}
                onClick={() => {
                  setCookie("anertic_current_site", site.id)
                  navigate(`/overview?site=${site.id}`)
                }}
                className={cn(
                  "group relative flex flex-col items-start rounded-xl border border-border/50 p-5 text-left transition-all",
                  "hover:border-border hover:shadow-md hover:-translate-y-0.5",
                )}
              >
                <div className="flex w-full items-start justify-between">
                  <div
                    className={cn(
                      "flex size-10 items-center justify-center rounded-xl text-sm font-bold ring-1",
                      accent.bg,
                      accent.text,
                      accent.ring,
                    )}
                  >
                    {site.name.charAt(0).toUpperCase()}
                  </div>
                  <RiArrowRightLine className="size-4 text-muted-foreground/30 transition-all group-hover:translate-x-0.5 group-hover:text-foreground/60" />
                </div>
                <p className="mt-3 text-sm font-semibold">{site.name}</p>
                <p className="mt-0.5 max-w-full truncate text-xs text-muted-foreground">
                  {site.address || site.timezone}
                </p>
                <div
                  className={cn(
                    "absolute bottom-0 left-5 right-5 h-0.5 rounded-full opacity-0 transition-opacity group-hover:opacity-100",
                    accent.dot,
                  )}
                />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
