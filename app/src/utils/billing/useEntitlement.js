import { useEffect, useMemo, useState } from "react";
import { usePatient } from "../patient/patientData";
import { usePatientAppointments } from "../../components/patient/ui";
import { entitlement } from "./plans";
import { saveSubscription } from "./billing";

const API_BASE = process.env.REACT_APP_API_BASE || "";

/**
 * What this patient is allowed to do, ready for any screen to ask.
 *
 * The billing server is the authority on what was paid for, because only it hears from Stripe.
 * This reads that, mirrors it onto the patient's own record so the app still works offline and
 * in demo mode, and turns it into plain allowances: sessions left this month, rehab plans left,
 * whether they may choose their own physiotherapist.
 */
export function useEntitlement() {
  const { user, data, loading } = usePatient();
  const appointments = usePatientAppointments(user?.email);
  const [serverSub, setServerSub] = useState(null);
  const [checked, setChecked] = useState(false);

  const email = user?.email;
  const isDemo = !!user?.isDemo;

  useEffect(() => {
    if (!email || isDemo) {
      setChecked(true);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/billing/subscription?email=${encodeURIComponent(email)}`);
        if (!res.ok) throw new Error("no billing server");
        const sub = await res.json();
        if (cancelled) return;
        setServerSub(sub);
        // Mirror onto the patient record, so the plan still shows if the billing server is down.
        if (sub?.planId && sub.planId !== data?.subscription?.planId) {
          saveSubscription(email, { planId: sub.planId, status: sub.status, currentPeriodEnd: sub.currentPeriodEnd });
        }
      } catch {
        /* no billing server: fall back to whatever is on the patient record */
      } finally {
        if (!cancelled) setChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [email, isDemo, data?.subscription?.planId]);

  const value = useMemo(() => {
    const subscription = serverSub?.planId ? serverSub : data?.subscription || null;
    const rehabPlans = data?.rehabPlan ? [data.rehabPlan] : [];
    const extraSessions = serverSub?.extraSessions ?? data?.extraSessions ?? 0;
    return entitlement({ subscription, appointments, rehabPlans, extraSessions });
  }, [serverSub, data, appointments]);

  return { ...value, user, email, appointments, loading: loading || !checked, isDemo, subscription: serverSub || data?.subscription || null };
}

export default useEntitlement;
