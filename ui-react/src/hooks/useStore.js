// React helpers for the native event streams and the browser controller.
//
// Native pushes its state out of band (browser.subscribe / overlay.subscribe),
// so the snapshot has to be read with useSyncExternalStore — the store owns
// the snapshot, the events invalidate it.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { attachChannel } from "../services/events.js";

/**
 * Reads an external store (getSnapshot/subscribe) as React state.
 *
 * @template T
 * @param {{getSnapshot: () => T, subscribe: (listener: () => void) => () => void}} store
 * @returns {T}
 */
export function useStore(store) {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

/**
 * Subscribes to a native channel for the lifetime of the component.
 *
 * @param {"browser"|"overlay"} channel
 * @param {(event: any) => void} handler
 */
export function useNativeChannel(channel, handler) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const cancel = attachChannel(channel, (event) => handlerRef.current(event));
    return cancel;
  }, [channel]);
}

/**
 * A value that is kept in sync with an async loader.
 *
 * @template T
 * @param {() => Promise<T>} loader
 * @param {T} initial
 * @param {unknown[]} deps
 * @returns {[T, () => void, boolean]}
 */
export function useAsyncValue(loader, initial, deps = []) {
  const [value, setValue] = useState(initial);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const reload = useCallback(() => {
    setLoading(true);
    loader()
      .then((next) => {
        if (mounted.current) setValue(next);
      })
      .catch(() => {
        /* keep the previous value */
      })
      .finally(() => {
        if (mounted.current) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    reload();
  }, [reload]);

  return [value, reload, loading];
}
