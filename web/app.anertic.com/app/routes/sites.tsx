import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { RiAddLine, RiMapPinLine, RiSearchLine } from '@remixicon/react'
import { toast } from 'sonner'
import useSWR from 'swr'

import { api } from '~/lib/api'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Skeleton } from '~/components/ui/skeleton'
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

const timezones = Intl.supportedValuesOf('timeZone')

export default function Sites() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [timezone, setTimezone] = useState('Asia/Bangkok')

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)
  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search])

  const { data, isLoading, mutate } = useSWR(
    ['site.list', debouncedSearch],
    () => api<ListResult>('site.list', { search: debouncedSearch }),
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
      const result = await api<CreateResult>('site.create', {
        name,
        address,
        timezone,
      })
      toast.success('Site created successfully')
      setOpen(false)
      resetForm()
      navigate(`/sites/${result.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create site')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Sites</h1>
          <p className="text-sm text-muted-foreground">
            Manage your energy monitoring sites
          </p>
        </div>
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button>
              <RiAddLine className="mr-2 h-4 w-4" />
              New Site
            </Button>
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
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      ) : sites.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <RiMapPinLine className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {search
              ? 'No sites found'
              : 'No sites yet. Create your first site to get started.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sites.map((site) => (
            <Card
              key={site.id}
              className="cursor-pointer transition-colors hover:bg-muted/50"
              onClick={() => navigate(`/sites/${site.id}`)}
            >
              <CardContent className="pt-6">
                <h3 className="font-medium">{site.name}</h3>
                {site.address && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {site.address}
                  </p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  {site.timezone}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
