import type { UserActor } from '../context/actor.js';

declare global {
  namespace Express {
    interface Request {
      actor?: UserActor;
    }
  }
}
