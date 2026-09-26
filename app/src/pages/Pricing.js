import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import VideocamIcon from "@mui/icons-material/Videocam";
import toast from "react-hot-toast";
import { PLANS, SESSION_TOPUP, priceLabel } from "../utils/billing/plans";
import { startCheckout } from "../utils/billing/billing";
import useEntitlement from "../utils/billing/useEntitlement";

/**
 * What RehabOS charges for, and why.
 *
 * The camera work is free on every plan: exercises, the 3D coach, the mood check-in. What the
 * plans buy is a physiotherapist's attention — their review of a rehab plan, and live video
 * sessions with them. Prices are in rupees and stay under the UPI AutoPay mandate ceiling, so a
 * patient can pay by UPI instead of needing a card.
 */
function Pricing() {
  const navigate = useNavigate();
  const { plan: currentPlan, email, loading } = useEntitlement();
  const [busy, setBusy] = useState(null);

  const choose = async (planId) => {
    if (!email) {
      toast.error("Sign in first, so the plan is attached to your account.");
      return;
    }
    setBusy(planId);
    try {
      const result = await startCheckout({ planId, email });
      if (result.outcome === "test") {
        toast.success(
          planId === "sessionTopup"
            ? "Test mode: an extra session was added without payment."
            : `Test mode: you are on ${result.plan.name}. No payment was taken.`
        );
        navigate("/dashboard");
      }
    } catch (err) {
      toast.error(err.message || "Could not start checkout.");
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "grid", placeItems: "center", minHeight: "60vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
      <Stack spacing={1} alignItems="center" textAlign="center" sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          Physiotherapy that comes to you
        </Typography>
        <Typography color="text.secondary" sx={{ maxWidth: 620 }}>
          Camera-guided exercises, the 3D coach and your digital twin are free, always. Plans pay for a
          physiotherapist's time: reviewing your rehab plan and seeing you on video.
        </Typography>
        <Chip label="Pay by UPI or card · cancel any time" variant="outlined" color="success" sx={{ mt: 1 }} />
      </Stack>

      <Box sx={{ display: "grid", gap: 2.5, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "repeat(4, 1fr)" } }}>
        {PLANS.map((p) => {
          const isCurrent = p.id === currentPlan.id;
          return (
            <Card
              key={p.id}
              variant="outlined"
              sx={{
                p: 2.5,
                borderRadius: 4,
                display: "flex",
                flexDirection: "column",
                position: "relative",
                // The "Most chosen" badge sits above the card edge, so it must not be clipped.
                overflow: "visible",
                borderColor: p.popular ? "primary.main" : undefined,
                borderWidth: p.popular ? 2 : 1,
              }}>
              {p.popular && (
                <Chip
                  label="Most chosen"
                  color="primary"
                  size="small"
                  sx={{ position: "absolute", top: -12, left: 20, fontWeight: 700 }}
                />
              )}
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {p.name}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ minHeight: 44, mt: 0.5 }}>
                {p.tagline}
              </Typography>

              <Stack direction="row" alignItems="baseline" spacing={0.5} sx={{ my: 1.5 }}>
                <Typography variant="h4" sx={{ fontWeight: 800 }}>
                  {priceLabel(p)}
                </Typography>
                {p.priceInr > 0 && (
                  <Typography variant="body2" color="text.secondary">
                    / month
                  </Typography>
                )}
              </Stack>

              <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
                <Chip size="small" variant="outlined" label={`${p.rehabPlans} rehab plan${p.rehabPlans === 1 ? "" : "s"}`} />
                <Chip
                  size="small"
                  variant="outlined"
                  color={p.liveSessionsPerMonth ? "primary" : "default"}
                  label={p.liveSessionsPerMonth ? `${p.liveSessionsPerMonth} live / month` : "No live sessions"}
                />
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5 }}>
                {p.cadence}
              </Typography>

              <Divider sx={{ mb: 1.5 }} />
              <Stack spacing={0.75} sx={{ flex: 1 }}>
                {p.features.map((f) => (
                  <Stack key={f} direction="row" spacing={1} alignItems="flex-start">
                    <CheckIcon fontSize="small" color="success" sx={{ mt: 0.2 }} />
                    <Typography variant="body2">{f}</Typography>
                  </Stack>
                ))}
              </Stack>

              <Button
                fullWidth
                variant={isCurrent ? "outlined" : p.popular ? "contained" : "outlined"}
                disabled={isCurrent || busy === p.id || p.priceInr === 0}
                onClick={() => choose(p.id)}
                sx={{ mt: 2, borderRadius: 2, textTransform: "none", fontWeight: 700 }}>
                {isCurrent ? "Your plan" : p.priceInr === 0 ? "Always free" : busy === p.id ? "Opening checkout…" : `Choose ${p.name}`}
              </Button>
            </Card>
          );
        })}
      </Box>

      <Card variant="outlined" sx={{ mt: 3, p: 2.5, borderRadius: 4 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }} justifyContent="space-between">
          <Stack direction="row" spacing={1.5} alignItems="center">
            <VideocamIcon color="primary" />
            <Box>
              <Typography sx={{ fontWeight: 700 }}>{SESSION_TOPUP.name}</Typography>
              <Typography variant="body2" color="text.secondary">
                {SESSION_TOPUP.description}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              {priceLabel(SESSION_TOPUP)}
            </Typography>
            <Button
              variant="contained"
              disabled={busy === SESSION_TOPUP.id}
              onClick={() => choose(SESSION_TOPUP.id)}
              sx={{ borderRadius: 2, textTransform: "none", fontWeight: 700 }}>
              {busy === SESSION_TOPUP.id ? "Opening…" : "Buy one session"}
            </Button>
          </Stack>
        </Stack>
      </Card>

      <Alert severity="info" sx={{ mt: 3, borderRadius: 3 }}>
        Payments run in Stripe test mode. Nothing is charged, and you can pay with a test UPI ID or the
        test card 4242 4242 4242 4242.
      </Alert>
    </Container>
  );
}

export default Pricing;
