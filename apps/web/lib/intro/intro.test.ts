import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  INTRO_MEDIA,
  INTRO_STORAGE_KEY,
  INTRO_TRANSCRIPT,
  captionTexts,
  hasHandledIntro,
  markIntroHandled,
  wantsIntroPlayback,
  withoutIntroQuery,
} from "./intro";

function memoryStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => void store.set(key, value), store };
}

test("a new browser has not handled the introduction yet", () => {
  assert.equal(hasHandledIntro(memoryStorage()), false);
});

test("playing or dismissing is remembered under the project storage prefix", () => {
  for (const outcome of ["played", "dismissed"] as const) {
    const storage = memoryStorage();
    markIntroHandled(outcome, storage);
    assert.equal(storage.store.get(INTRO_STORAGE_KEY), outcome);
    assert.equal(hasHandledIntro(storage), true);
  }
  assert.match(INTRO_STORAGE_KEY, /^fest-compass\./);
});

test("unknown stored values do not suppress the offer", () => {
  assert.equal(hasHandledIntro(memoryStorage({ [INTRO_STORAGE_KEY]: "yes" })), false);
});

test("blocked storage hides the offer instead of repeating it on every visit and never throws", () => {
  const throwing = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
  assert.equal(hasHandledIntro(throwing), true);
  assert.equal(hasHandledIntro(null), true);
  assert.doesNotThrow(() => markIntroHandled("played", throwing));
  assert.doesNotThrow(() => markIntroHandled("played", null));
});

test("only intro=play requests direct playback", () => {
  assert.equal(wantsIntroPlayback("?intro=play"), true);
  assert.equal(wantsIntroPlayback("?a=1&intro=play"), true);
  assert.equal(wantsIntroPlayback("?intro=1"), false);
  assert.equal(wantsIntroPlayback(""), false);
});

test("the playback request is removed while other query values survive", () => {
  assert.equal(withoutIntroQuery("/", "?intro=play"), "/");
  assert.equal(withoutIntroQuery("/", "?utm=a&intro=play", "#top"), "/?utm=a#top");
});

test("captions say exactly what the transcript says", () => {
  const vtt = readFileSync(join(process.cwd(), "public", INTRO_MEDIA.captions), "utf8");
  assert.ok(vtt.startsWith("WEBVTT"));
  const normalize = (text: string) => text.replace(/\s+/g, " ").trim();
  assert.equal(normalize(captionTexts(vtt).join(" ")), normalize(INTRO_TRANSCRIPT.join(" ")));
});

test("published media files exist and the video stays small enough for the web", () => {
  for (const path of [INTRO_MEDIA.video, INTRO_MEDIA.poster, INTRO_MEDIA.captions]) {
    assert.ok(statSync(join(process.cwd(), "public", path)).size > 0, path);
  }
  assert.ok(statSync(join(process.cwd(), "public", INTRO_MEDIA.video)).size < 12 * 1024 * 1024);
});
