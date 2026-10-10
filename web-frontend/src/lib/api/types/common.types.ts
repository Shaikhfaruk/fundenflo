export type Page<T> = { items: T[]; nextCursor: string | null };

export type PartyRef = { id: string; kind?: string; displayName: string };

export type IdKeyName = { id: string; key: string; name: string };
