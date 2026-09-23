"use client";
import { writeAddress } from "@/components/existing/address";
import { durableParams, type DURABLE_KEYS } from "./durable";

/** Change one durable condition of the current address without adding a history entry (condition change). */
export function setAddressParam(key: (typeof DURABLE_KEYS)[number], value: string | null) {
  writeAddress(durableParams(new URLSearchParams(window.location.search), { [key]: value }));
}
