"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowUpRight, ArrowDownLeft, UserPlus, Settings, Loader2, ExternalLink, RefreshCw } from "lucide-react"
import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { fetchContractEvents, ActivityEvent } from "@/hooks/useJointSaveContracts"

const PAGE_SIZE = 20

interface SupabaseActivity {
  id: string
  activity_type: string
  user_address: string | null
  amount: number | null
  description: string | null
  created_at: string
  tx_hash: string | null
}

type Activity = ActivityEvent

function toActivity(a: SupabaseActivity): Activity {
  return { ...a, source: "offchain" }
}

function mergeAndDedupe(onchain: Activity[], offchain: Activity[]): Activity[] {
  const seen = new Set<string>()
  const merged: Activity[] = []
  for (const a of [...onchain, ...offchain]) {
    const key = a.tx_hash ?? a.id
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(a)
  }
  return merged.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
}

export function GroupActivity({
  groupId,
  contractId,
  startLedger = 0,
}: {
  groupId: string
  contractId?: string
  startLedger?: number
}) {
  const [allActivities, setAllActivities] = useState<Activity[]>([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchActivities = useCallback(
    async (isAutoRefresh = false) => {
      try {
        isAutoRefresh ? setRefreshing(true) : setLoading(true)

        const [poolRes, onchainEvents] = await Promise.allSettled([
          fetch(`/api/pools?id=${groupId}`).then((r) => r.json()),
          contractId
            ? fetchContractEvents(contractId, startLedger)
            : Promise.resolve([] as Activity[]),
        ])

        const supabaseRows: SupabaseActivity[] =
          poolRes.status === "fulfilled" && Array.isArray(poolRes.value?.pool_activity)
            ? poolRes.value.pool_activity
            : []

        const onchain: Activity[] =
          onchainEvents.status === "fulfilled" ? onchainEvents.value : []

        setAllActivities(mergeAndDedupe(onchain, supabaseRows.map(toActivity)))
      } catch (err) {
        console.error("Failed to fetch activities:", err)
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [groupId, contractId, startLedger]
  )

  useEffect(() => {
    fetchActivities()
    const interval = setInterval(() => fetchActivities(true), 30_000)
    return () => clearInterval(interval)
  }, [fetchActivities])

  const formatAddress = (address: string | null) => {
    if (!address) return "System"
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return "Unknown"
      const diffMs = Date.now() - date.getTime()
      if (diffMs < 0) return "Just now"
      const diffMins = Math.floor(diffMs / 60000)
      const diffHours = Math.floor(diffMins / 60)
      const diffDays = Math.floor(diffHours / 24)
      if (diffMins < 1) return "Just now"
      if (diffMins < 60) return `${diffMins}m ago`
      if (diffHours < 24) return `${diffHours}h ago`
      if (diffDays < 7) return `${diffDays}d ago`
      return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
    } catch {
      return "Unknown"
    }
  }

  const visible = allActivities.slice(0, page * PAGE_SIZE)
  const hasMore = visible.length < allActivities.length

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Recent Activity</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fetchActivities()}
          disabled={refreshing}
          className="h-8 w-8 p-0"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {allActivities.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">No activity yet</p>
      ) : (
        <>
          <div className="space-y-4">
            {visible.map((activity: Activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-4 pb-4 border-b border-border last:border-0 last:pb-0"
              >
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-lg flex-shrink-0 ${
                    activity.activity_type === "deposit"
                      ? "bg-primary/10"
                      : activity.activity_type === "payout"
                      ? "bg-accent/10"
                      : "bg-muted"
                  }`}
                >
                  {activity.activity_type === "deposit" && (
                    <ArrowUpRight className="h-5 w-5 text-primary" />
                  )}
                  {activity.activity_type === "payout" && (
                    <ArrowDownLeft className="h-5 w-5 text-accent" />
                  )}
                  {activity.activity_type === "member_joined" && (
                    <UserPlus className="h-5 w-5 text-muted-foreground" />
                  )}
                  {!["deposit", "payout", "member_joined"].includes(activity.activity_type) && (
                    <Settings className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="font-medium text-sm capitalize">
                      {({
                        deposit: "Deposit",
                        payout: "Payout",
                        withdraw: "Withdraw",
                        complete: "Pool Complete",
                        member_joined: "Member Joined",
                        pool_created: "Pool Created",
                        yield: "Yield Distributed",
                      } as Record<string, string>)[activity.activity_type] ?? activity.activity_type}
                    </p>
                    {activity.amount != null && (
                      <Badge variant="secondary">{activity.amount.toFixed(2)} XLM</Badge>
                    )}
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        activity.source === "onchain"
                          ? "border-blue-400 text-blue-600"
                          : "border-gray-300 text-gray-500"
                      }`}
                    >
                      {activity.source === "onchain" ? "🔗 on-chain" : "📝 off-chain"}
                    </Badge>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {formatAddress(activity.user_address)} • {formatTime(activity.created_at)}
                  </p>

                  {activity.description && (
                    <p className="text-xs text-muted-foreground mt-1">{activity.description}</p>
                  )}

                  {activity.tx_hash ? (
                    <a
                      href={`https://stellar.expert/explorer/testnet/tx/${activity.tx_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                    >
                      {activity.tx_hash.slice(0, 8)}…{activity.tx_hash.slice(-6)}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">No tx hash</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {hasMore && (
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-4"
              onClick={() => setPage((p: number) => p + 1)}
            >
              Load more
            </Button>
          )}
        </>
      )}
    </Card>
  )
}
