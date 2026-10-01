import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONFIRM_ACTIVE_MS, CONFIRM_DELAY_MS, confirmStage, confirmStep } from '@/services/site-confirm';

describe('action confirmée en deux clics', () => {
  it('sans premier clic : rien à confirmer', () => {
    expect(confirmStage(undefined, 1000)).toBe('idle');
  });

  it('juste après le premier clic : « Confirmer ? » inactif', () => {
    expect(confirmStage(1000, 1000)).toBe('waiting');
    expect(confirmStage(1000, 1000 + CONFIRM_DELAY_MS - 1)).toBe('waiting');
  });

  it('puis actif, un temps', () => {
    expect(confirmStage(1000, 1000 + CONFIRM_DELAY_MS)).toBe('asking');
    expect(confirmStage(1000, 1000 + CONFIRM_DELAY_MS + CONFIRM_ACTIVE_MS - 1)).toBe('asking');
  });

  it('puis de nouveau rien ; une horloge qui recule aussi', () => {
    expect(confirmStage(1000, 1000 + CONFIRM_DELAY_MS + CONFIRM_ACTIVE_MS)).toBe('idle');
    expect(confirmStage(1000, 999)).toBe('idle');
  });
});

describe('confirmStep', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('premier clic : attente, puis « Confirmer ? » ; le second confirme ; prévenu à chaque étape', () => {
    const onChange = vi.fn();
    const step = confirmStep<string>({ onChange, signal: new AbortController().signal });
    expect(step.press('a')).toBe(false);
    expect(step.stage('a')).toBe('waiting');
    expect(step.stage('b')).toBe('idle');
    expect(onChange).toHaveBeenCalledTimes(1);
    // Un clic pendant l'attente ne fait rien.
    expect(step.press('a')).toBe(false);
    vi.advanceTimersByTime(CONFIRM_DELAY_MS + 20);
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(step.stage('a')).toBe('asking');
    expect(step.press('a')).toBe(true);
    expect(step.stage('a')).toBe('idle');
  });

  it('sans second clic, la confirmation expire', () => {
    const onChange = vi.fn();
    const step = confirmStep<string>({ onChange, signal: new AbortController().signal });
    step.press('a');
    vi.advanceTimersByTime(CONFIRM_DELAY_MS + CONFIRM_ACTIVE_MS + 20);
    expect(onChange).toHaveBeenCalledTimes(3);
    expect(step.stage('a')).toBe('idle');
  });
});
