import { SETTING_LABELS, type Setting } from '@antelope/core';

const HONORIFIC = /^(mr|mrs|ms|mx|miss|dr|prof)\.?$/i;

/**
 * How the coach refers to the person you're talking with: "Josh" for
 * "Josh Brooks", "Ms. Alvarez" for "Ms. Rosa Alvarez" / "Ms. Alvarez".
 * An honorific never stands alone as a name.
 */
export function callName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length > 1 && HONORIFIC.test(parts[0])) return `${parts[0]} ${parts[parts.length - 1]}`;
  return parts[0] ?? fullName;
}

/** "One-on-one" / "Visit": the conversation noun, sentence case. */
export function conversationLabel(setting: Setting): string {
  const w = SETTING_LABELS[setting].conversation;
  return w.charAt(0).toUpperCase() + w.slice(1);
}
