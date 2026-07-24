export const toTitle = (value: string): string => {
  return value
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

export const normalizeInput = (value: string): string => {
  return value.trim().toLowerCase();
};

export const nowIso = (): string => new Date().toISOString();
