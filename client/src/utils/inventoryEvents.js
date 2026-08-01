export function emitInventoryChanged() {
  window.dispatchEvent(new CustomEvent('afritrade:inventory-changed'));
}

/** Debounced listener — coalesces rapid inventory updates into one refetch. */
export function onInventoryChanged(handler, { debounceMs = 600 } = {}) {
  let timer;
  const wrapped = () => {
    clearTimeout(timer);
    timer = setTimeout(handler, debounceMs);
  };
  window.addEventListener('afritrade:inventory-changed', wrapped);
  return () => {
    clearTimeout(timer);
    window.removeEventListener('afritrade:inventory-changed', wrapped);
  };
}
