const SUFFIXES = ["", "K", "M", "B", "T", "Qa", "Qi"];

export function formatNumber(value: number, digits = 2): string {
  if (!Number.isFinite(value)) {
    return "0";
  }

  const sign = value < 0 ? "-" : "";
  let scaled = Math.abs(value);
  let suffixIndex = 0;

  while (scaled >= 1000 && suffixIndex < SUFFIXES.length - 1) {
    scaled /= 1000;
    suffixIndex += 1;
  }

  if (suffixIndex === 0) {
    return `${sign}${Math.floor(scaled).toLocaleString("en-US")}`;
  }

  const fixedDigits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : digits;
  return `${sign}${scaled.toFixed(fixedDigits)}${SUFFIXES[suffixIndex]}`;
}

export function formatSeconds(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes > 0 ? `${minutes}:${rest.toString().padStart(2, "0")}` : `${rest}s`;
}

export function formatClock(seconds: number): string {
  const capped = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(capped / 3600);
  const minutes = Math.floor((capped % 3600) / 60);
  const rest = capped % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${rest}s`;
  }

  return `${rest}s`;
}
