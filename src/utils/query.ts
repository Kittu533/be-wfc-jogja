export function getQueryString(query: Record<string, unknown>, key: string): string {
  const value = query[key];

  if (Array.isArray(value)) {
    return String(value[0] ?? "");
  }

  return String(value ?? "");
}
