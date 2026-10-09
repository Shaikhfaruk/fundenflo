export function isValidPattern(pattern: string): boolean {
  try {
    return RegExp(pattern, 'u') instanceof RegExp;
  } catch {
    return false;
  }
}
