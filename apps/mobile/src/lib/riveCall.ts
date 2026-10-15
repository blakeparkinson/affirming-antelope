/**
 * Calls a Rive view method that is typed to return a promise. On a native view that is being
 * torn down (the screen lost focus, the file was disposed) the call can return nothing or throw
 * synchronously, so a bare `v.pause().catch(...)` crashed with "undefined is not a function".
 * This always hands back a promise: the call's own, or a rejected one.
 */
export function riveCall<T>(call: () => Promise<T>): Promise<T> {
  try {
    const p = call() as Promise<T> | undefined;
    return p && typeof p.then === 'function' ? p : Promise.reject(new Error('Rive call returned no promise'));
  } catch (e) {
    return Promise.reject(e);
  }
}
