/** Lower-case DNS hostname with at least two labels (shared by the Worker and the browser). */
export function isHostname(value: string): boolean {
  const labels = value.split(".");
  return value.length <= 253 && labels.length >= 2 &&
    labels.every(label => /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(label));
}
