"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Calendar, TrendingUp, Users, Clock, Loader2, RefreshCw, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"
import {
  stroopsToXlm,
  RotationalPoolState,
  TargetPoolState,
  FlexiblePoolState,
} from "@/hooks/useJointSaveContracts"
import { usePoolData } from "@/lib/data-layer/PoolDataProvider"

interface GroupDetailsProps {
  groupId: string
  /** Contract address if already known — avoids a redundant /api/pools fetch */
  contractAddress?: string
}

export function GroupDetails({ groupId, contractAddress }: GroupDetailsProps) {
  // Use contract address as cache key when available; otherwise key on DB id.
  // The provider resolves DB data first, so the DB id key works fine too.
  const cacheKey =
    contractAddress && contractAddress !== "pending_deployment"
      ? contractAddress
      : groupId

  const { data, isLoading, isStale, isPaused, error, refetch } = usePoolData(cacheKey)

  const group = data?.db ?? null
  const onchainState = data?.onchain ?? null

  const isPending = (addr: string) => !addr || addr === "pending_deployment"
  const formatType = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

  if (isLoading && !group) {
    return (
      <Card className="p-12">
        <div className="flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Card>
    )
  }

  if (error || !group) {
    return (
      <Card className="p-6 bg-destructive/10 text-destructive">
        <p>{error || "Group not found"}</p>
      </Card>
    )
  }

  // ── Live stats (prefer onchain data over DB) ────────────────────────────────
  const getLiveStats = () => {
    const base = [{ icon: Users, label: "Members", value: group.members_count || 0 }]

    if (group.type === "rotational" && onchainState) {
      const s = onchainState as RotationalPoolState
      const nextPayout =
        s.nextPayoutTime > 0
          ? new Date(s.nextPayoutTime * 1000).toLocaleDateString()
          : "N/A"
      base.unshift({ icon: TrendingUp, label: "Round", value: `${s.currentRound + 1} / ${s.members.length || group.members_count}` })
      base.push({ icon: Clock, label: "Next Payout", value: nextPayout })
      base.push({ icon: Calendar, label: "Frequency", value: group.frequency || "N/A" })
    } else if (group.type === "target" && onchainState) {
      const s = onchainState as TargetPoolState
      base.unshift({ icon: TrendingUp, label: "Total Saved", value: `${stroopsToXlm(s.totalDeposited).toFixed(2)} XLM` })
      base.push({ icon: Calendar, label: "Target", value: `${stroopsToXlm(s.targetAmount).toFixed(2)} XLM` })
      base.push({ icon: Clock, label: "Deadline", value: group.deadline ? new Date(group.deadline).toLocaleDateString() : "N/A" })
    } else if (group.type === "flexible" && onchainState) {
      const s = onchainState as FlexiblePoolState
      base.unshift({ icon: TrendingUp, label: "Total Balance", value: `${stroopsToXlm(s.totalBalance).toFixed(2)} XLM` })
      base.push({ icon: Clock, label: "Your Balance", value: `${stroopsToXlm(s.userBalance).toFixed(2)} XLM` })
      base.push({ icon: Calendar, label: "Status", value: s.isActive ? "Active" : "Inactive" })
    } else {
      // Fallback to DB data
      base.unshift({ icon: TrendingUp, label: "Total Saved", value: `${(group.total_saved || 0).toFixed(2)} XLM` })
      if (group.type === "rotational") {
        base.push({ icon: Clock, label: "Next Payout", value: group.next_payout || "N/A" })
        base.push({ icon: Calendar, label: "Frequency", value: group.frequency || "N/A" })
      } else if (group.type === "target") {
        base.push({ icon: Calendar, label: "Target", value: `${(group.target_amount || 0).toFixed(2)} XLM` })
        base.push({ icon: Clock, label: "Deadline", value: group.deadline ? new Date(group.deadline).toLocaleDateString() : "N/A" })
      } else {
        base.push({ icon: Clock, label: "Status", value: group.status })
        base.push({ icon: Calendar, label: "Created", value: new Date(group.created_at).toLocaleDateString() })
      }
    }
    return base
  }

  const getProgress = () => {
    if (group.type === "target" && onchainState) {
      const s = onchainState as TargetPoolState
      if (s.targetAmount === 0n) return 0
      return Math.min(100, Number((s.totalDeposited * 100n) / s.targetAmount))
    }
    return group.progress || 0
  }

  const getTargetDisplay = () => {
    if (group.type === "target" && onchainState) {
      const s = onchainState as TargetPoolState
      return { saved: stroopsToXlm(s.totalDeposited), target: stroopsToXlm(s.targetAmount) }
    }
    return { saved: group.total_saved || 0, target: group.target_amount || 0 }
  }

  const stats = getLiveStats()
  const progress = getProgress()
  const targetDisplay = getTargetDisplay()

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <Card className="p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">{group.name}</h1>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{formatType(group.type)}</Badge>
              <Badge className="bg-primary/10 text-primary hover:bg-primary/20">{group.status}</Badge>
              {onchainState && <Badge variant="outline" className="text-xs">Live onchain</Badge>}
              {isStale && !isLoading && (
                <Badge variant="outline" className="text-xs text-amber-500 border-amber-500/40">
                  Stale
                </Badge>
              )}
            </div>
          </div>
          {/* Manual refresh binds to provider refetch — no local state needed */}
          <Button variant="ghost" size="icon" onClick={refetch} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {group.description && <p className="text-muted-foreground mb-6">{group.description}</p>}

        {isPaused && !isPending(group.contract_address) && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive mb-4 text-sm font-medium">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>⚠️ Pool Paused — All deposits and withdrawals are currently disabled.</span>
          </div>
        )}

        {isPending(group.contract_address) && (
          <div className="p-3 rounded-lg bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 mb-4 text-sm">
            Contract pending deployment. Run <code>scripts/deploy.sh</code> and update the contract address.
          </div>
        )}

        {!isPending(group.contract_address) && (
          <div className="mb-4 p-2 rounded bg-muted/30">
            <p className="text-xs text-muted-foreground font-mono break-all">Contract: {group.contract_address}</p>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {stats.map((stat, i) => (
            <motion.div key={i} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: i * 0.1 }} className="p-4 rounded-lg bg-muted/30">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <stat.icon className="h-4 w-4" />
                <span className="text-sm">{stat.label}</span>
              </div>
              <p className="text-2xl font-bold">{stat.value}</p>
            </motion.div>
          ))}
        </div>

        {group.type === "target" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress to Target</span>
              <span className="font-medium">
                {targetDisplay.saved.toFixed(2)} / {targetDisplay.target.toFixed(2)} XLM
              </span>
            </div>
            <Progress value={progress} className="h-3" />
            <p className="text-xs text-muted-foreground">{progress.toFixed(1)}% complete</p>
          </div>
        )}
      </Card>
    </motion.div>
  )
}
