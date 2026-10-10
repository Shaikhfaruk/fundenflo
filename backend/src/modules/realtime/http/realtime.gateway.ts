import { Logger } from '@nestjs/common';
import { type OnGatewayConnection, WebSocketGateway } from '@nestjs/websockets';
import type { Socket } from 'socket.io';

import { SessionContext } from '../../../common/enums/db.enums.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { RevocationRegistry } from '../../../infrastructure/security/revocation.service.js';
import { TokenService } from '../../auth/application/token.service.js';
import { REALTIME_NAMESPACE, RealtimeEvent, RealtimeRoom } from '../../../infrastructure/realtime/realtime.constants.js';

const ORGANIZATION_CONTEXTS: ReadonlySet<SessionContext> = new Set([SessionContext.partner, SessionContext.lender]);

const BEARER = /^Bearer\s+(.+)$/i;

@WebSocketGateway({ namespace: REALTIME_NAMESPACE })
export class RealtimeGateway implements OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly tokens: TokenService,
    private readonly revocations: RevocationRegistry,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const claims = await this.tokens.verifyAccessToken(this.tokenOf(client));
      if (await this.revocations.isRevoked({ sessionId: claims.sessionId, userId: claims.userId, membershipId: claims.membershipId })) throw new AppError(ErrorCode.SESSION_REVOKED);
      const rooms = [RealtimeRoom.user(claims.userId), RealtimeRoom.session(claims.sessionId)];
      if (claims.membershipId) rooms.push(RealtimeRoom.membership(claims.membershipId));
      if (claims.organizationId && ORGANIZATION_CONTEXTS.has(claims.context)) rooms.push(RealtimeRoom.organization(claims.organizationId));
      if (claims.context === SessionContext.staff) rooms.push(RealtimeRoom.staff);
      await client.join(rooms);
      client.emit(RealtimeEvent.Ready, { context: claims.context });
    } catch (error) {
      const code = error instanceof AppError ? error.code : ErrorCode.UNAUTHENTICATED;
      if (!(error instanceof AppError)) this.logger.warn({ err: error }, 'realtime connection refused');
      client.emit(RealtimeEvent.Error, { code });
      client.disconnect(true);
    }
  }

  private tokenOf(client: Socket): string {
    const auth = client.handshake.auth as { token?: unknown } | undefined;
    if (typeof auth?.token === 'string' && auth.token.length > 0) return auth.token;
    const header = BEARER.exec(client.handshake.headers.authorization ?? '');
    if (header?.[1]) return header[1];
    throw new AppError(ErrorCode.UNAUTHENTICATED);
  }
}
