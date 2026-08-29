/**
 * Renderer-independent single-flight loader.
 *
 * A module may use this to make its rules-visible preload idempotent without
 * sharing renderer state. The cache owns only the in-flight promise and an
 * optional disposer supplied by the module that created the resource.
 */
export function CreateSingleFlightPreloadCache() {
  let entry = null;

  function Load(key, loader, options = {}) {
    const normalizedKey = String(key || '').trim();
    if (!normalizedKey) throw new TypeError('A preload key is required.');
    if (entry?.key === normalizedKey && !entry.controller.signal.aborted) {
      return entry.promise;
    }

    if (entry && entry.key !== normalizedKey) {
      AbortEntry(entry, 'superseded');
    }

    const controller = new AbortController();
    const nextEntry = {
      key: normalizedKey,
      controller,
      disposer: options.dispose,
      promise: null,
      settled: false,
    };

    const promise = Promise.resolve()
      .then(() => {
        if (controller.signal.aborted) throw CreateAbortError(controller.signal.reason);
        return loader(controller.signal);
      })
      .then((value) => {
        nextEntry.settled = true;
        if (controller.signal.aborted) {
          DisposeValue(nextEntry, value);
          throw CreateAbortError(controller.signal.reason);
        }
        if (entry === nextEntry) nextEntry.value = value;
        return value;
      })
      .catch((error) => {
        nextEntry.settled = true;
        if (entry === nextEntry) entry = null;
        throw error;
      });

    nextEntry.promise = promise;
    entry = nextEntry;
    return promise;
  }

  function Abort(key, reason = 'aborted') {
    if (!entry || (key !== undefined && entry.key !== key)) return false;
    AbortEntry(entry, reason);
    return true;
  }

  function Clear(key) {
    if (!entry || (key !== undefined && entry.key !== key)) return false;
    const current = entry;
    AbortEntry(current, 'cleared');
    if (Object.hasOwn(current, 'value')) DisposeValue(current, current.value);
    if (entry === current && current.settled) entry = null;
    return true;
  }

  function Has(key) {
    return entry?.key === key && !entry.controller.signal.aborted;
  }

  return Object.freeze({ load: Load, abort: Abort, clear: Clear, has: Has });
}

function AbortEntry(current, reason) {
  if (!current.controller.signal.aborted) current.controller.abort(reason);
  if (Object.hasOwn(current, 'value')) DisposeValue(current, current.value);
}

function DisposeValue(current, value) {
  if (current.disposed) return;
  current.disposed = true;
  try {
    const result = current.disposer?.(value);
    if (result && typeof result.catch === 'function') result.catch(() => undefined);
  } catch {
    // Disposal is best effort; the loader must still reject/settle.
  }
}

function CreateAbortError(reason) {
  const error = new Error(reason ? `Preload ${String(reason)}.` : 'Preload aborted.');
  error.name = 'AbortError';
  return error;
}
