/**
 * Hour targets.
 *
 * These are constants until the settings screen exists; `timesheet_weeks`
 * already stores a per-week target so history stays correct if they change.
 */

export const DAILY_TARGET_MINUTES = 450; // 7.50 h
export const WEEKLY_TARGET_MINUTES = 2250; // 37.50 h

export const DAILY_TARGET_SECONDS = DAILY_TARGET_MINUTES * 60;
export const WEEKLY_TARGET_SECONDS = WEEKLY_TARGET_MINUTES * 60;
