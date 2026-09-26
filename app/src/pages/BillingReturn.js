import React, { useEffect, useRef, useState } from "react";
import { Link as RouterLink, useNavigate, useSearchParams } from "react-router-dom";
import { Alert, Box, Button, CircularProgress, Container, Stack, Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import HourglassTopIcon from "@mui/icons-material/HourglassTop";
import { getAuth } from "firebase/auth";
import { planById } from "../utils/billing/plans";

const API_BASE = process.env.REACT_APP_API_BASE || "";
const POLL_MS = 2500;
const GIVE_UP_AFTER = 12; // half a minute of asking

/**
 * The screen a patient lands on after paying.
 *
 * It asks the server what Stripe has confirmed, rather than believing the address bar. UPI
 * settles asynchronously, so "paid" can arrive a little after the patient is back here; this
 * waits for it, and says plainly what is happening instead of pretending either way.
 */
function BillingReturn() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = params.get("session_id");
  const [state, setState] = useState("checking"); // checking | granted | pending | failed
  const [planName, setPlanName] = useState(null);
  const tries = useRef(0);

  useEffect(() => {
    const email = getAuth().currentUser?.email;
    if (!sessionId || !email) {
      setState("failed");
      return undefined;
    }
    let stop = false;

    const ask = async () => {
      tries.current += 1;
      try {
        const res = await fetch(`${API_BASE}/api/billing/subscription?email=${encodeURIComponent(email)}`);
        const sub = res.ok ? await res.json() : null;
        if (stop) return;
        if (sub?.planId && ["active", "trialing", "past_due"].includes(sub.status)) {
          setPlanName(planById(sub.planId).name);
          setState("granted");
          return;
        }
        if (sub?.extraSessions) {
          setState("granted");
          setPlanName(null);
          return;
        }
      } catch {
        /* keep waiting: the webhook may not have arrived yet */
      }
      if (stop) return;
      if (tries.current >= GIVE_UP_AFTER) setState("pending");
      else setTimeout(ask, POLL_MS);
    };
    ask();
    return () => {
      stop = true;
    };
  }, [sessionId]);

  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Stack spacing={2} alignItems="center" textAlign="center">
        {state === "checking" && (
          <>
            <CircularProgress />
            <Typography variant="h6">Confirming your payment with Stripe…</Typography>
            <Typography color="text.secondary">
              A UPI payment can take a few seconds to settle. This page updates itself.
            </Typography>
          </>
        )}

        {state === "granted" && (
          <>
            <CheckCircleIcon color="success" sx={{ fontSize: 64 }} />
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {planName ? `You are on ${planName}` : "Your extra session is ready"}
            </Typography>
            <Typography color="text.secondary">
              Your physiotherapist time is available now. You can book a session from your dashboard.
            </Typography>
            <Stack direction="row" spacing={1.5} sx={{ pt: 1 }}>
              <Button variant="contained" onClick={() => navigate("/dashboard")}>
                Go to my dashboard
              </Button>
              <Button component={RouterLink} to="/book-session">
                Book a session
              </Button>
            </Stack>
          </>
        )}

        {state === "pending" && (
          <>
            <HourglassTopIcon color="warning" sx={{ fontSize: 64 }} />
            <Typography variant="h6">Your bank has not confirmed yet</Typography>
            <Alert severity="info" sx={{ textAlign: "left" }}>
              This is normal for UPI. Nothing is lost — as soon as Stripe tells us the payment settled,
              your plan appears on your dashboard. If it has not arrived in a few minutes, check your UPI
              app before paying again.
            </Alert>
            <Button variant="contained" onClick={() => navigate("/dashboard")}>
              Back to my dashboard
            </Button>
          </>
        )}

        {state === "failed" && (
          <>
            <Typography variant="h6">We could not find that payment</Typography>
            <Typography color="text.secondary">
              Sign in with the account you paid from, and your plan will be on your dashboard.
            </Typography>
            <Button component={RouterLink} to="/pricing" variant="contained">
              Back to plans
            </Button>
          </>
        )}
      </Stack>
    </Container>
  );
}

export default BillingReturn;
