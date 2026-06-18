"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Users, TrendingUp, Calendar, ArrowRight, Loader2 } from "lucide-react"
import Link from "next/link"
import { motion } from "framer-motion"
import { useState, useEffect } from "react"
import { useStellar } from "@/components/web3-provider"
import { usePoolData } from "@/lib/data-layer/PoolDataProvider"
import {
  stroopsToXlm,
  RotationalPoolState,
  TargetPoolState,
  FlexiblePoolState,
} from "@/hooks/useJointSaveContracts"
import { EmptyState } from "@/components/dashboard/empty-state"
import { FirstPoolTooltip } from "@/components/dashboard/first-pool-tooltip"

interface Pool {
  id: string
  name: string
  type: "rotational" | "target" | "flexible"
  status: "active" | "completed" | "paused"
  members_count: number
  total_saved: number
  progress: number
  frequency?: string
  next_payout?: string
  contract_address: string
  target_amount: number | null
  contribution_amount: number | null
  minimum_deposit: number | null
}

interface MyGroupsProps {
  onCreateClick?: () => void
}

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } }
const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }

// ── Per-pool card that hydrates live balances from the unified cache ──────────
function PoolCard({ pool }: { pool: Pool }) {
  // Use contract address as cache key for deployed pools, fallback to DB id
  const cacheKey =
    pool.contract_address && pool.contract_address !== "pending_deployment"
      ? pool.contract_address
      : pool.id

  const { data, isLoading } = usePoolData(cacheKey)

  // Derive live stats from cache when available
  const getLiveStats = (): { totalSaved: number; progress: number; progressLabel: string } => {
    const onchain = data?.onchain ?? null

    if (pool.type === "rotational" && onchain) {
      const s = onchain as RotationalPoolState
      const totalMembers = s.members.length || pool.members_count || 1
      const progress = Math.min(100, Math.round((s.currentRound / totalMembers) * 100))
      const perRound = (pool.contribution_amount || 0) * totalMembers
      const totalSaved = s.currentRound * perRound
      return {
        totalSaved,
        progress,
        progressLabel: `Round ${s.currentRound + 1} of ${totalMembers}`,
      }
    }

    if (pool.type === "target" && onchain) {
      const s = onchain as TargetPoolState
      const saved = stroopsToXlm(s.totalDeposited)
      const target = pool.target_amount || stroopsToXlm(s.targetAmount) || 1
      const progress = Math.min(100, Math.round((saved / target) * 100))
      return {
        totalSaved: saved,
        progress,
        progressLabel: `${saved.toFixed(2)} / ${target.toFixed(2)} XLM`,
      }
    }

    if (pool.type === "flexible" && onchain) {
      const s = onchain as FlexiblePoolState
      const totalSaved = stroopsToXlm(s.totalBalance)
      const softGoal = (pool.minimum_deposit || 0) * (pool.members_count || 1)
      const progress =
        softGoal > 0
          ? Math.min(100, Math.round((totalSaved / softGoal) * 100))
          : s.isActive
          ? 50
          : 100
      return {
        totalSaved,
        progress,
        progressLabel:
          softGoal > 0
            ? `${totalSaved.toFixed(2)} / ${softGoal.toFixed(2)} XLM`
            : `${totalSaved.toFixed(2)} XLM saved`,
      }
    }

    // Fallback to DB data
    return { totalSaved: pool.total_saved ?? 0, progress: pool.progress ?? 0, progressLabel: "" }
  }

  const { totalSaved, progress, progressLabel } = getLiveStats()
  const formatXlm = (n: number) => `${n.toFixed(2)} XLM`

  return (
    <motion.div variants={item}>
      <Card className="p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 h-full flex flex-col">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-xl font-semibold mb-1">{pool.name}</h3>
            <Badge variant="secondary">{pool.type.charAt(0).toUpperCase() + pool.type.slice(1)}</Badge>
          </div>
          <Badge className="bg-primary/10 text-primary hover:bg-primary/20">{pool.status}</Badge>
        </div>

        <div className="space-y-3 mb-4 flex-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />Members
            </span>
            <span className="font-medium">{pool.members_count}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />Total Saved
            </span>
            <span className="font-medium">
              {isLoading && !data?.onchain ? (
                <Loader2 className="h-3 w-3 animate-spin inline text-primary" />
              ) : (
                formatXlm(totalSaved)
              )}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {pool.type === "rotational" ? "Frequency" : "Status"}
            </span>
            <span className="font-medium">{pool.frequency || pool.status}</span>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{progress.toFixed(1)}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1, delay: 0.5 }}
              className="h-full bg-primary"
            />
          </div>
          {progressLabel && (
            <p className="text-xs text-muted-foreground mt-1">{progressLabel}</p>
          )}
        </div>

        <Button className="w-full bg-transparent" variant="outline" asChild>
          <Link href={`/dashboard/group/${pool.id}`}>
            View Details <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </Card>
    </motion.div>
  )
}

// ── Main MyGroups component ───────────────────────────────────────────────────

export function MyGroups({ onCreateClick }: MyGroupsProps) {
  const { address } = useStellar()
  const [pools, setPools] = useState<Pool[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!address) { setLoading(false); return }
    loadPools()
  }, [address])

  const loadPools = async () => {
    try {
      setLoading(true)
      setError("")
      const res = await fetch(`/api/pools?creator=${address?.toLowerCase()}`)
      if (!res.ok) throw new Error("Failed to fetch pools")
      const data: Pool[] = await res.json()
      setPools(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch pools")
      setPools([])
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <div className="space-y-6">
      <div><h2 className="text-3xl font-bold">My Groups</h2></div>
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    </div>
  )

  if (error) return (
    <div className="space-y-6">
      <div><h2 className="text-3xl font-bold">My Groups</h2></div>
      <Card className="p-6 bg-destructive/10 text-destructive"><p>{error}</p></Card>
    </div>
  )

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">My Groups</h2>
          <p className="text-muted-foreground mt-1">
            {pools.length === 0 ? "Manage your savings circles" : `${pools.length} active group${pools.length !== 1 ? "s" : ""}`}
          </p>
        </div>
      </motion.div>

      {pools.length === 0 ? (
        <EmptyState onCreateClick={onCreateClick} />
      ) : (
        <>
          <FirstPoolTooltip poolCount={pools.length} />
          <motion.div variants={container} initial="hidden" animate="show"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pools.map((pool) => (
              <PoolCard key={pool.id} pool={pool} />
            ))}
          </motion.div>
        </>
      )}
    </div>
  )
}
