// Consent for optional analytics is owned by the tag manager, not by this app.
//
// The zone shows one Cloudflare consent modal for every published site, so the
// vocabulary of purposes, the wording, and the stored decision all live there.
// This module only asks the tag manager to reopen that modal, which is the one
// thing a visitor cannot do for themselves once the banner is dismissed.
//
// Deliberately absent: any CMP purpose identifier, any measurement id, and any
// copy of the decision. The published dictionary declares
// appDefinesCmpPurposeId: false, and the only way to keep that true across a
// growing number of sites is to never learn the purposes at all.
interface ZarazConsentHost {
  showConsentModal?: () => void;
}

function zaraz(): ZarazConsentHost | null {
  if (typeof window === "undefined") {
    return null;
  }
  return (window as unknown as { zaraz?: ZarazConsentHost }).zaraz ?? null;
}

/** True once the tag manager is present and able to reopen its modal. */
export function canManageConsent(): boolean {
  return typeof zaraz()?.showConsentModal === "function";
}

/** Reopen the tag manager's consent modal so a decision can be changed. */
export function openConsentSettings(): void {
  const client = zaraz();
  if (typeof client?.showConsentModal !== "function") {
    return;
  }
  try {
    client.showConsentModal();
  } catch {
    // Consent plumbing must never break the page.
  }
}
