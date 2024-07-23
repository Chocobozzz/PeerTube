export function getBackendUrl () {
  return (import.meta as any).env.VITE_BACKEND_URL || window.location.origin
}
