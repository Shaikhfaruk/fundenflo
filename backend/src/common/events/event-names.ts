export const EventName = {
  PartyCreated: 'party.created',
  PartyMatchReviewOpened: 'party.match_review.opened',
  UserSignedUp: 'user.signed_up',
  UserStatusChanged: 'user.status_changed',
  UserMobileChanged: 'user.mobile_changed',
  LoginLinked: 'login.linked',
  LoginRemoved: 'login.removed',
  SessionCreated: 'session.created',
  SessionRevoked: 'session.revoked',
  MembershipCreated: 'membership.created',
  MembershipChanged: 'membership.changed',
  InvitationCreated: 'invitation.created',
  InvitationAccepted: 'invitation.accepted',
  InvitationRevoked: 'invitation.revoked',
} as const;

export type EventName = (typeof EventName)[keyof typeof EventName];
