import { useEffect, useState } from 'preact/hooks';
import { confirmStep, type ConfirmStep } from './step';

/** Confirmation en deux clics dans un composant, redessiné quand « Confirmer ? » s'active puis expire. */
export function useConfirmStep<T>(): ConfirmStep<T> {
  const [, redraw] = useState(0);
  const [state] = useState(() => {
    const controller = new AbortController();
    return { controller, step: confirmStep<T>({ onChange: () => redraw((n) => n + 1), signal: controller.signal }) };
  });
  useEffect(() => () => state.controller.abort(), [state]);
  return state.step;
}
