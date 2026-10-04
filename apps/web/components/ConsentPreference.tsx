import { ConsentSettingsButton } from "@/components/ConsentSettingsButton";

/**
 * Privacy-page control that reopens the site's consent banner so the choice can be changed or
 * withdrawn. Where the tag manager is absent (development, previews, a blocking browser) the
 * banner itself says there is nothing to choose, so the control is always rendered.
 */
export function ConsentPreference() {
  return (
    <div className="mt-3 rounded-2xl bg-paper p-4">
      <ConsentSettingsButton className="rounded-full bg-navy px-4 py-2 text-sm font-bold text-white hover:bg-blue" />
    </div>
  );
}
