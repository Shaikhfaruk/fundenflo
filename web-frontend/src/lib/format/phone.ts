const INDIA = /^\+91(\d{5})(\d{5})$/;

export function formatPhone(value: string | null | undefined): string {
  if (!value) return '';
  const match = INDIA.exec(value);
  return match ? `+91 ${match[1]} ${match[2]}` : value;
}
