/**
 * Runtime overrides of the material.glass tokens for the tuning labs (glass, probe): deep-merges
 * a patch such as { regular: { bezel: 8 }, hairline: { width: 0.7 } }; an array replaces the one it
 * patches whole. Kept for later calls; copy fitted values into app/tokens/material.tokens.json.
 */
import { tokens } from '../../tokens/tokens.ts';

export type Overrides = Record<string, unknown>;

function merge(target: Record<string, unknown>, patch: Overrides): void {
  for (const [key, value] of Object.entries(patch)) {
    const current = target[key] as Record<string, unknown> | undefined;
    if (value && typeof value === 'object' && !Array.isArray(value) && current && typeof current === 'object') merge(current, value as Overrides);
    else target[key] = value;
  }
}

export const overrideGlass = (patch: Overrides) => merge(tokens.material.glass as unknown as Record<string, unknown>, patch);
