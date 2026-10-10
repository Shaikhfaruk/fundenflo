type Listener = (error: unknown) => void;

const listeners = new Set<Listener>();

export function reportMutationError(error: unknown) {
  listeners.forEach((listener) => listener(error));
}

export function onMutationError(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
