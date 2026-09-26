import React, { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Box, Button, Chip, LinearProgress, Stack, Typography } from "@mui/material";
import WorkspacePremiumIcon from "@mui/icons-material/WorkspacePremium";
import VideocamIcon from "@mui/icons-material/Videocam";
import toast from "react-hot-toast";
import { SectionCard } from "../patient/ui";
import useEntitlement from "../../utils/billing/useEntitlement";
import { nextPlanUp, priceLabel, SESSION_TOPUP } from "../../utils/billing/plans";
import { openBillingPortal, startCheckout } from "../../utils/billing/billing";

/**
 * The patient's plan, in the terms they care about: how many sessions and rehab plans are left
 * this month, and what to do when they run out.
 */
function PlanCard({ sx }) {
  const { plan, sessions, plans, renewsOn, email, subscription, isDemo } = useEntitlement();
  const [busy, setBusy] = useState(false);
  const upgrade = nextPlanUp(plan.id);
  const testMode = subscription?.testMode;

  const used = sessions.limit ? Math.min(100, (sessions.used / sessions.limit) * 100) : 0;

  const buyExtra = async () => {
    setBusy(true);
    try {
      const r = await startCheckout({ planId: SESSION_TOPUP.id, email });
      if (r.outcome === "test") toast.success("Test mode: an extra session was added without payment.");
    } catch (err) {
      toast.error(err.message || "Could not open checkout.");
    } finally {
      setBusy(false);
    }
  };

  const manage = async () => {
    setBusy(true);
    try {
      await openBillingPortal(email);
    } catch (err) {
      // Say what actually went wrong rather than guessing at the cause.
      toast.error(err.message || "Billing management is not available right now.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SectionCard
      title="Your plan"
      icon={<WorkspacePremiumIcon />}
      action={<Chip size="small" label={plan.name} color={plan.priceInr ? "primary" : "default"} />}
      sx={sx}>
      <Stack spacing={1.5}>
        <Stack direction="row" alignItems="baseline" spacing={1}>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            {priceLabel(plan)}
          </Typography>
          {plan.priceInr > 0 && (
            <Typography variant="body2" color="text.secondary">
              per month · {plan.cadence.toLowerCase()}
            </Typography>
          )}
        </Stack>

        <Box>
          <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Live sessions
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {sessions.limit ? `${sessions.used} of ${sessions.limit} booked` : "Not on this plan"}
            </Typography>
          </Stack>
          {sessions.limit > 0 && (
            <LinearProgress
              variant="determinate"
              value={used}
              color={sessions.exhausted ? "warning" : "primary"}
              sx={{ height: 10, borderRadius: 5 }}
            />
          )}
          <Typography variant="caption" color="text.secondary">
            {sessions.limit
              ? `Renews ${renewsOn.toLocaleDateString()}`
              : "Upgrade to see a physiotherapist on video"}
          </Typography>
        </Box>

        <Typography variant="body2" color="text.secondary">
          Rehab plans: {plans.used} of {plans.limit} in use
        </Typography>

        {testMode && (
          <Chip size="small" color="warning" variant="outlined" label="Test mode — no payment was taken" />
        )}

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {upgrade && (
            <Button size="small" variant="contained" component={RouterLink} to="/pricing" sx={{ textTransform: "none" }}>
              Upgrade to {upgrade.name}
            </Button>
          )}
          {sessions.limit > 0 && (
            <Button size="small" variant="outlined" startIcon={<VideocamIcon />} onClick={buyExtra} disabled={busy}>
              Extra session {priceLabel(SESSION_TOPUP)}
            </Button>
          )}
          {plan.priceInr > 0 && !isDemo && (
            <Button size="small" onClick={manage} disabled={busy}>
              Manage billing
            </Button>
          )}
        </Stack>
      </Stack>
    </SectionCard>
  );
}

export default PlanCard;
