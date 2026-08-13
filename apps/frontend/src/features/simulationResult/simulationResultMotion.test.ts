// @ts-expect-error Vitest runs this file in Node; the browser bundle intentionally omits Node typings.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const motionCss = readFileSync(new URL('./simulationResultMotion.css', import.meta.url), 'utf8');

function getKeyframes(name: string): string {
  const start = motionCss.indexOf(`@keyframes ${name}`);
  const end = motionCss.indexOf('@keyframes', start + 1);
  return motionCss.slice(start, end === -1 ? undefined : end);
}

describe('simulation result collapse motion', () => {
  it.each(['evacuation-chart-suck', 'improvement-panel-suck', 'summary-panel-suck'])(
    'keeps %s on a single compositor-friendly motion curve',
    (animationName) => {
      const keyframes = getKeyframes(animationName);

      expect(keyframes).not.toBe('');
      expect(keyframes).not.toContain('filter:');
      expect(keyframes).not.toMatch(/\b(?:45|48)%/);
      expect(keyframes).toContain('translate3d(');
    },
  );
});
