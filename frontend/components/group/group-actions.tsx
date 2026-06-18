"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  ArrowUpRight,
  ArrowDownLeft,
  AlertCircle,
  CheckCircle2,
  ShieldOff,
  ShieldCheck,
  Clock,
} from "lucide-react";
import { useStellar } from "@/components/web3-provider";
import {
  useRotationalDeposit,
  useTriggerPayout,
  useTargetContribute,
  useTargetWithdraw,
  useTargetRefund,
  useFlexibleDeposit,
  useFlexibleWithdraw,
  usePausePool,
  useUnpausePool,
  stroopsToXlm,
} from "@/hooks/useJointSaveContracts";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useOptimisticTransactions } from "@/hooks/useOptimisticTransactions";
import { toastManager } from "@/lib/toast";

interface GroupActionsProps {
  groupId: string;
  poolAddress: string;
  poolType: "rotational" | "target" | "flexible";
  tokenAddress: string;
  isPaused?: boolean;
  poolAdmin?: string | null;
  onPauseChange?: () => void;
}

async function logActivity(
  poolId: string,
  type: string,
  userAddress: string,
  amount: string | null,
  txHash: string,
) {
  try {
    await fetch("/api/pools", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: poolId,
        activity: {
          activity_type: type,
          user_address: userAddress,
          amount: amount ? parseFloat(amount) : null,
          tx_hash: txHash,
        },
      }),
    });
  } catch {}
}

export function GroupActions({
  groupId,
  poolAddress,
  poolType,
  isPaused = false,
  poolAdmin = null,
  onPauseChange,
}: GroupActionsProps) {
  const { address } = useStellar();
  const isAdmin =
    !!address &&
    !!poolAdmin &&
    address.toUpperCase() === poolAdmin.toUpperCase();
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const rotationalDeposit = useRotationalDeposit(poolAddress);
  const triggerPayout = useTriggerPayout(poolAddress);
  const targetContribute = useTargetContribute(poolAddress, depositAmount);
  const targetWithdraw = useTargetWithdraw(poolAddress);
  const targetRefund = useTargetRefund(poolAddress);
  const flexibleDeposit = useFlexibleDeposit(poolAddress, depositAmount);
  const flexibleWithdraw = useFlexibleWithdraw(poolAddress, withdrawAmount);
  const pausePool = usePausePool(poolAddress);
  const unpausePool = useUnpausePool(poolAddress);

  const { optimisticState, registerOptimistic, updateTxHash, markFailed } =
    useOptimisticTransactions(poolAddress);

  const isPending = !poolAddress || poolAddress === "pending_deployment";

  // Watch for confirmation/failure from optimistic state
  useEffect(() => {
    const { pendingTx } = optimisticState;
    if (!pendingTx) return;

    if (pendingTx.status === "confirmed") {
      toastManager.success(
        `${pendingTx.type.charAt(0).toUpperCase() + pendingTx.type.slice(1)} confirmed ✓`,
      );
      setDepositAmount("");
      setWithdrawAmount("");
    } else if (pendingTx.status === "failed") {
      toastManager.error(
        `${pendingTx.type} failed — ${pendingTx.error || "please retry"}`,
      );
    }
  }, [optimisticState]);

  const handleDeposit = async () => {
    setError("");
    setSuccessMsg("");
    if (!address) return setError("Please connect your wallet first");
    if (isPending) return setError("Contract not yet deployed.");
    if (isPaused) return setError("Pool is paused. Deposits are disabled.");
    try {
      const amount =
        poolType !== "rotational"
          ? BigInt(Math.round(parseFloat(depositAmount) * 10_000_000))
          : undefined;
      registerOptimistic("deposit", address, amount);

      let txHash: string | undefined;
      if (poolType === "rotational") txHash = await rotationalDeposit.deposit();
      else if (poolType === "target")
        txHash = await targetContribute.contribute();
      else txHash = await flexibleDeposit.deposit();

      if (txHash) {
        updateTxHash(txHash);
        await logActivity(
          groupId,
          "deposit",
          address,
          depositAmount || null,
          txHash,
        );
        setSuccessMsg("Deposit submitted (confirming on-chain)…");
      }
    } catch (e: any) {
      const msg = e.message || "Transaction failed";
      setError(msg);
      markFailed(msg);
    }
  };

  const handleWithdraw = async () => {
    setError("");
    setSuccessMsg("");
    if (!address) return setError("Please connect your wallet first");
    if (isPending) return setError("Contract not yet deployed.");
    if (isPaused) return setError("Pool is paused. Withdrawals are disabled.");
    try {
      const amount =
        poolType === "flexible" && withdrawAmount
          ? BigInt(Math.round(parseFloat(withdrawAmount) * 10_000_000))
          : undefined;
      registerOptimistic("withdraw", address, amount);

      let txHash: string | undefined;
      if (poolType === "target") txHash = await targetWithdraw.withdraw();
      else txHash = await flexibleWithdraw.withdraw();

      if (txHash) {
        updateTxHash(txHash);
        await logActivity(
          groupId,
          "withdraw",
          address,
          withdrawAmount || null,
          txHash,
        );
        setSuccessMsg("Withdrawal submitted (confirming on-chain)…");
      }
    } catch (e: any) {
      const msg = e.message || "Transaction failed";
      setError(msg);
      markFailed(msg);
    }
  };

  const handleTriggerPayout = async () => {
    setError("");
    setSuccessMsg("");
    if (!address) return setError("Please connect your wallet first");
    if (isPending) return setError("Contract not yet deployed.");
    if (isPaused) return setError("Pool is paused. Payouts are disabled.");
    try {
      registerOptimistic("trigger_payout", address);

      const txHash = await triggerPayout.trigger();
      if (txHash) {
        updateTxHash(txHash);
        await logActivity(groupId, "payout", address, null, txHash);
        setSuccessMsg("Payout trigger submitted (confirming on-chain)…");
      }
    } catch (e: any) {
      const msg = e.message || "Transaction failed";
      setError(msg);
      markFailed(msg);
    }
  };

  const handleRefund = async () => {
    setError("");
    setSuccessMsg("");
    if (!address) return setError("Please connect your wallet first");
    if (isPending) return setError("Contract not yet deployed.");
    try {
      const txHash = await targetRefund.refund();
      if (txHash) {
        await logActivity(groupId, "refund", address, null, txHash);
        setSuccessMsg("Refund initiated!");
      }
    } catch (e: any) {
      setError(e.message || "Transaction failed");
    }
  };

  const handlePause = async () => {
    setError("");
    setSuccessMsg("");
    if (!address) return setError("Please connect your wallet first");
    if (isPending) return setError("Contract not yet deployed.");
    try {
      await pausePool.pause();
      setSuccessMsg("Pool paused successfully.");
      onPauseChange?.();
    } catch (e: any) {
      setError(e.message || "Transaction failed");
    }
  };

  const handleUnpause = async () => {
    setError("");
    setSuccessMsg("");
    if (!address) return setError("Please connect your wallet first");
    if (isPending) return setError("Contract not yet deployed.");
    try {
      await unpausePool.unpause();
      setSuccessMsg("Pool unpaused successfully.");
      onPauseChange?.();
    } catch (e: any) {
      setError(e.message || "Transaction failed");
    }
  };

  const isDepositLoading =
    optimisticState.pendingTx?.type === "deposit" &&
    optimisticState.pendingTx.status === "pending"
      ? true
      : poolType === "rotational"
        ? rotationalDeposit.isLoading
        : poolType === "target"
          ? targetContribute.isLoading
          : flexibleDeposit.isLoading;

  const isWithdrawLoading =
    optimisticState.pendingTx?.type === "withdraw" &&
    optimisticState.pendingTx.status === "pending"
      ? true
      : poolType === "target"
        ? targetWithdraw.isLoading
        : flexibleWithdraw.isLoading;

  const isRotational = poolType === "rotational";
  const isTarget = poolType === "target";
  const isFlexible = poolType === "flexible";
  const actionsDisabled = isPaused || isPending || !address;

  // Helper to render pending badge
  const renderPendingBadge = () => {
    const { pendingTx } = optimisticState;
    if (pendingTx && pendingTx.status === "pending") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 text-xs font-medium">
          <Clock className="h-3 w-3 animate-spin" />
          Pending…
        </span>
      );
    }
    return null;
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">
        Quick Actions {renderPendingBadge()}
      </h3>

      {error && (
        <div className="flex gap-2 p-3 rounded-lg bg-destructive/10 text-destructive mb-4">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {successMsg && (
        <div className="flex gap-2 p-3 rounded-lg bg-primary/10 text-primary mb-4">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm">{successMsg}</p>
        </div>
      )}

      {isPaused && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive mb-4 text-sm font-medium">
          ⚠️ Pool is paused — all transactions are disabled.
        </div>
      )}

      {isPending && !isPaused && (
        <div className="p-3 rounded-lg bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 mb-4 text-sm">
          Contract pending deployment.
        </div>
      )}

      <div className="space-y-6">
        {/* Deposit / Contribute */}
        <div className="space-y-3">
          <Label htmlFor="deposit">
            {isRotational
              ? "Deposit Fixed Amount"
              : isTarget
                ? "Contribute Amount (XLM)"
                : "Deposit Amount (XLM)"}
          </Label>
          {!isRotational && (
            <Input
              id="deposit"
              type="number"
              step="0.01"
              placeholder="100"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              disabled={isDepositLoading || actionsDisabled}
            />
          )}
          <p className="text-xs text-muted-foreground">
            {isRotational &&
              "Deposit the fixed pool amount. Same for all members."}
            {isTarget && "Contribute any amount toward the target goal."}
            {isFlexible &&
              "Deposit any amount (must meet minimum). Withdraw anytime."}
          </p>
          <Button
            className="w-full bg-primary hover:bg-primary/90"
            onClick={handleDeposit}
            disabled={isDepositLoading || actionsDisabled}
          >
            {isDepositLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <ArrowUpRight className="mr-2 h-4 w-4" />
                {isTarget ? "Contribute" : "Deposit"}
              </>
            )}
          </Button>
        </div>

        {/* Withdraw */}
        {!isRotational && (
          <div className="border-t border-border pt-6 space-y-3">
            <Label htmlFor="withdraw">
              {isTarget ? "Withdraw Share" : "Withdraw Amount (XLM)"}
            </Label>
            {isFlexible && (
              <Input
                id="withdraw"
                type="number"
                step="0.01"
                placeholder="100"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                disabled={isWithdrawLoading || actionsDisabled}
              />
            )}
            <p className="text-xs text-muted-foreground">
              {isTarget && "Withdraw after target reached. Exit fee deducted."}
              {isFlexible && "Withdraw anytime. Exit fee will be deducted."}
            </p>
            <Button
              variant="outline"
              className="w-full bg-transparent"
              onClick={handleWithdraw}
              disabled={
                isWithdrawLoading ||
                actionsDisabled ||
                (isFlexible && !withdrawAmount)
              }
            >
              {isWithdrawLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <ArrowDownLeft className="mr-2 h-4 w-4" />
                  Withdraw
                </>
              )}
            </Button>

            {isTarget && (
              <Button
                variant="ghost"
                className="w-full text-destructive hover:text-destructive"
                onClick={handleRefund}
                disabled={targetRefund.isLoading || !address || isPending}
              >
                {targetRefund.isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Refund (if deadline passed)"
                )}
              </Button>
            )}
          </div>
        )}

        {/* Rotational payout trigger */}
        {isRotational && (
          <div className="border-t border-border pt-6 space-y-3">
            <p className="text-xs text-muted-foreground">
              Rotational Pool: Payouts are triggered when the round time is
              reached. You earn a relayer fee for triggering.
            </p>
            <Button
              variant="outline"
              className="w-full bg-transparent"
              onClick={handleTriggerPayout}
              disabled={
                optimisticState.pendingTx?.type === "trigger_payout" ||
                triggerPayout.isLoading ||
                actionsDisabled
              }
            >
              {optimisticState.pendingTx?.type === "trigger_payout" ||
              triggerPayout.isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <ArrowDownLeft className="mr-2 h-4 w-4" />
                  Trigger Payout
                </>
              )}
            </Button>
          </div>
        )}

        {/* Admin: Pause / Unpause */}
        {!isPending && (
          <div className="border-t border-border pt-6 space-y-3">
            <p className="text-xs text-muted-foreground font-medium">
              Admin Controls
            </p>
            {!isAdmin && (
              <p className="text-xs text-muted-foreground">
                Only the pool admin can pause or unpause this pool.
              </p>
            )}
            <div className="flex gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex-1">
                    <Button
                      variant="outline"
                      className="w-full bg-transparent text-destructive border-destructive/50 hover:bg-destructive/10 disabled:opacity-50"
                      onClick={handlePause}
                      disabled={
                        pausePool.isLoading || !address || isPaused || !isAdmin
                      }
                    >
                      {pausePool.isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Pausing...
                        </>
                      ) : (
                        <>
                          <ShieldOff className="mr-2 h-4 w-4" />
                          Pause Pool
                        </>
                      )}
                    </Button>
                  </span>
                </TooltipTrigger>
                {!isAdmin && (
                  <TooltipContent>
                    {!address
                      ? "Connect your wallet to manage this pool"
                      : "Your wallet is not the pool admin"}
                  </TooltipContent>
                )}
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex-1">
                    <Button
                      variant="outline"
                      className="w-full bg-transparent text-green-600 border-green-600/50 hover:bg-green-600/10 disabled:opacity-50"
                      onClick={handleUnpause}
                      disabled={
                        unpausePool.isLoading ||
                        !address ||
                        !isPaused ||
                        !isAdmin
                      }
                    >
                      {unpausePool.isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Unpausing...
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="mr-2 h-4 w-4" />
                          Unpause Pool
                        </>
                      )}
                    </Button>
                  </span>
                </TooltipTrigger>
                {!isAdmin && (
                  <TooltipContent>
                    {!address
                      ? "Connect your wallet to manage this pool"
                      : "Your wallet is not the pool admin"}
                  </TooltipContent>
                )}
              </Tooltip>
            </div>
          </div>
        )}

        <div className="border-t border-border pt-6">
          <p className="text-xs text-muted-foreground mb-2">
            Your Stellar address
          </p>
          <p className="text-sm font-mono bg-muted/30 p-2 rounded break-all">
            {address || "Not connected"}
          </p>
        </div>
      </div>
    </Card>
  );
}
