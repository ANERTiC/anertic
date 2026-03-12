import { useState } from "react"
import { RiMailLine, RiCheckLine, RiCloseLine, RiTimeLine, RiBuilding2Line } from "@remixicon/react"
import useSWR from "swr"
import { toast } from "sonner"

import { api } from "~/lib/api"
import { cn } from "~/lib/utils"

interface MyInvite {
  id: string
  siteId: string
  siteName: string
  role: string
  invitedBy: string
  expiresAt: string
  createdAt: string
}

interface MyInvitesResult {
  items: MyInvite[]
}

const ROLE_LABELS: Record<string, string> = {
  "*": "Owner",
  editor: "Editor",
  viewer: "Viewer",
}

function formatTimeLeft(expiresAt: string) {
  const diff = new Date(expiresAt).getTime() - Date.now()
  if (diff <= 0) return "Expired"
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  if (days > 0) return `${days}d ${hours}h left`
  return `${hours}h left`
}

export function PendingInvites() {
  const { data, isLoading, mutate } = useSWR(
    "site.myInvites",
    () => api<MyInvitesResult>("site.myInvites"),
  )
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const invites = data?.items || []

  if (isLoading || invites.length === 0) return null

  async function handleAccept(id: string) {
    setLoadingId(id)
    try {
      await api("site.acceptInvite", { id })
      toast.success("Invitation accepted")
      mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to accept")
    } finally {
      setLoadingId(null)
    }
  }

  async function handleDecline(id: string) {
    setLoadingId(id)
    try {
      await api("site.declineInvite", { id })
      toast.success("Invitation declined")
      mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to decline")
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="mb-8">
      <div className="overflow-hidden rounded-xl border border-primary/15 bg-primary/[0.03]">
        {/* Header */}
        <div className="flex items-center gap-2.5 border-b border-primary/10 px-5 py-3">
          <RiMailLine className="size-4 text-primary/60" />
          <span className="text-xs font-medium text-foreground/50">
            Pending Invitations
          </span>
          <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
            {invites.length}
          </span>
        </div>

        {/* Invite list */}
        <div className="divide-y divide-primary/8">
          {invites.map((invite) => {
            const busy = loadingId === invite.id
            return (
              <div
                key={invite.id}
                className={cn(
                  "flex items-center gap-4 px-5 py-3.5 transition-opacity",
                  busy && "pointer-events-none opacity-50",
                )}
              >
                {/* Site initial */}
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                  {invite.siteName.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {invite.siteName}
                  </p>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>
                      from <span className="font-medium text-foreground/60">{invite.invitedBy}</span>
                    </span>
                    <span className="text-border">·</span>
                    <span>{ROLE_LABELS[invite.role] || invite.role}</span>
                    <span className="text-border">·</span>
                    <span className="inline-flex items-center gap-0.5">
                      <RiTimeLine className="size-3" />
                      {formatTimeLeft(invite.expiresAt)}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    onClick={() => handleDecline(invite.id)}
                    disabled={busy}
                    className="flex size-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-muted"
                  >
                    <RiCloseLine className="size-4" />
                  </button>
                  <button
                    onClick={() => handleAccept(invite.id)}
                    disabled={busy}
                    className="flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    <RiCheckLine className="size-3.5" />
                    Accept
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
