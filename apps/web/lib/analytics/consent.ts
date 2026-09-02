// Consent state for optional analytics.
//
// The app owns the banner but not the consent vocabulary. Cloudflare's
// `setAll` grants or refuses every configured purpose at once, so no CMP
// purpose identifier is written into this repository — the same boundary the
// published dictionary declares with appDefinesCmpPurposeId: false.
//
// Analytics is refused until the visitor chooses. An unanswered visitor, a
// visitor who refused, and a visitor whose browser blocks storage all end in
// the same place: nothing is sent.
export const CONSENT_STORAGE_KEY = "fest-compass-analytics-consent";

export type ConsentChoice = "granted" | "denied";

interface ZarazConsentClient {
  setAll?: (granted: boolean) => void;
}

interface ZarazConsentHost {
  consent?: ZarazConsentClient;
  showConsentModal?: () => void;
}

function zarazConsent(): ZarazConsentHost | null {
  if (typeof window === "undefined") {
    return null;
  }
  return (window as unknown as { zaraz?: ZarazConsentHost }).zaraz ?? null;
}

export function isConsentChoice(value: unknown): value is ConsentChoice {
  return value === "granted" || value === "denied";
}

export function readStoredConsent(): ConsentChoice | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const stored = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    return isConsentChoice(stored) ? stored : null;
  } catch {
    // A browser that refuses storage is treated as undecided, which means
    // analytics stays off.
    return null;
  }
}

export function storeConsent(choice: ConsentChoice): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, choice);
  } catch {
    // The choice still applies to this page view even if it cannot persist.
  }
}

/** Tell Zaraz about a decision. Refusal and withdrawal both call through. */
export function applyConsent(choice: ConsentChoice): void {
  const consent = zarazConsent()?.consent;
  if (typeof consent?.setAll !== "function") {
    return;
  }
  try {
    consent.setAll(choice === "granted");
  } catch {
    // Consent plumbing must never break the page.
  }
}

export function recordConsent(choice: ConsentChoice): void {
  storeConsent(choice);
  applyConsent(choice);
}
