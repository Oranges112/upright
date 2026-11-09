import { describe, expect, it } from "vitest";
import { inActiveWindow, isReminderDue, nextReminderAt } from "@/lib/schedule";
import { defaultSettings } from "@/lib/merge";
import type { Settings } from "@/lib/types";

const settings = (patch: Partial<Settings> = {}): Settings => ({ ...defaultSettings(), tz: "UTC", ...patch });
// Monday 10 Nov 2025, in UTC
const at = (h: number, m = 0) => Date.UTC(2025, 10, 10, h, m);
const MIN = 60_000;

describe("reminder window", () => {
  it("is active during working hours on a working day", () => {
    expect(inActiveWindow(settings(), at(10))).toBe(true);
  });
  it("is inactive before start, after end, and on days off", () => {
    expect(inActiveWindow(settings(), at(8, 59))).toBe(false);
    expect(inActiveWindow(settings(), at(18))).toBe(false);
    expect(inActiveWindow(settings({ days: [2, 3] }), at(10))).toBe(false);
  });
  it("respects the user's timezone", () => {
    // 07:00 UTC is 11:00 in Dubai (UTC+4): inside 9-18 there, outside in UTC
    expect(inActiveWindow(settings({ tz: "Asia/Dubai" }), at(7))).toBe(true);
    expect(inActiveWindow(settings(), at(7))).toBe(false);
  });
});

describe("isReminderDue", () => {
  it("fires once an interval has passed since the window opened", () => {
    expect(isReminderDue(settings(), {}, at(9, 30))).toBe(false);
    expect(isReminderDue(settings(), {}, at(10))).toBe(true);
  });
  it("waits a full interval after a session", () => {
    const st = { lastSessionAt: at(10) };
    expect(isReminderDue(settings(), st, at(10, 30))).toBe(false);
    expect(isReminderDue(settings(), st, at(11))).toBe(true);
  });
  it("doesn't fire twice for the same interval", () => {
    expect(isReminderDue(settings(), { lastReminderAt: at(10) }, at(10, 5))).toBe(false);
  });
  it("stays quiet while snoozed, then fires when the snooze ends", () => {
    const st = { lastReminderAt: at(10), snoozeUntil: at(10, 30) };
    expect(isReminderDue(settings(), st, at(10, 15))).toBe(false);
    expect(isReminderDue(settings(), st, at(10, 30))).toBe(true);
  });
  it("never fires when reminders are off", () => {
    expect(isReminderDue(settings({ remindersOn: false }), {}, at(12))).toBe(false);
  });
});

describe("nextReminderAt", () => {
  it("finds the next reminder within the day", () => {
    const next = nextReminderAt(settings(), { lastSessionAt: at(10) }, at(10, 1));
    expect(next).not.toBeNull();
    expect(Math.abs(next! - at(11))).toBeLessThanOrEqual(5 * MIN);
  });
  it("returns null when reminders are off", () => {
    expect(nextReminderAt(settings({ remindersOn: false }), {}, at(10))).toBeNull();
  });
});
