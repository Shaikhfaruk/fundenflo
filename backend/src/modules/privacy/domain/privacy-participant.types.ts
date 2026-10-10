export type PrivacySubject = { userId: string | null; personPartyId: string; partyIds: string[]; requestRef: string };

export interface PrivacyParticipant {
  relatedParties?(personPartyId: string): Promise<string[]>;
  export?(subject: PrivacySubject): Promise<unknown>;
  holds?(subject: PrivacySubject): Promise<string[]>;
  erase?(subject: PrivacySubject): Promise<Record<string, number>>;
}
