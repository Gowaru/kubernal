import { useCallback, useEffect, useRef, useState } from 'react';

export interface SubmitLock {
  /** Vrai dès qu'une soumission est en cours (verrou synchrone + `isPending`). */
  busy: boolean;
  /** Prend le verrou. Retourne `false` si une soumission est déjà en cours. */
  acquire: () => boolean;
  /** Libère le verrou — à appeler au settle de la mutation. */
  release: () => void;
}

/**
 * Verrou anti double-soumission.
 *
 * `mutation.isPending` (TanStack Query) n'atteint le rendu qu'après un
 * `setTimeout(0)` (notifyManager → systemSetTimeoutZero) : deux clics rapprochés
 * — ou un clic + une frappe Enter — passent tous les deux avant que le bouton ne
 * soit désactivé. Ce hook pose donc un verrou **synchrone** (ref) dès le premier
 * appel, complété par un état React pour désactiver l'UI immédiatement.
 *
 * Usage :
 * ```ts
 * const submit = useSubmitLock(mutation.isPending);
 * const handleSubmit = (): void => {
 *   if (!valid) return;              // validations AVANT le verrou
 *   if (!submit.acquire()) return;   // double-clic / Enter concurrent
 *   mutation.mutate(payload, { ..., onSettled: () => submit.release() });
 * };
 * ```
 * Le verrou est libéré au settle de la mutation : une erreur n'empêche donc
 * jamais de retenter la soumission. Un filet de sécurité le libère aussi
 * automatiquement quand `isPending` repasse à `false`.
 */
export function useSubmitLock(isPending = false): SubmitLock {
  const lockRef = useRef(false);
  const seenPendingRef = useRef(false);
  const [locked, setLocked] = useState(false);

  const acquire = useCallback((): boolean => {
    if (lockRef.current || isPending) return false;
    lockRef.current = true;
    setLocked(true);
    return true;
  }, [isPending]);

  const release = useCallback((): void => {
    if (!lockRef.current) return;
    lockRef.current = false;
    setLocked(false);
  }, []);

  // Filet de sécurité : libère le verrou quand la mutation est terminée, même
  // si `release()` a été oublié dans les callbacks de la mutation.
  useEffect(() => {
    if (isPending) {
      seenPendingRef.current = true;
      return;
    }
    if (seenPendingRef.current) {
      seenPendingRef.current = false;
      release();
    }
  }, [isPending, release]);

  return { busy: locked || isPending, acquire, release };
}
