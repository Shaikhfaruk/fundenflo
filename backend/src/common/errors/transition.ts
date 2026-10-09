import { type Machine, TransitionError } from '../../engines/state-machines/define-machine.js';
import { AppError } from './app-error.js';
import { ErrorCode } from './error-codes.js';

export function transitionOrThrow<S extends string, E extends string>(machine: Machine<S, E>, state: S, event: E): S {
  try {
    return machine.next(state, event);
  } catch (error) {
    if (error instanceof TransitionError) throw new AppError(ErrorCode.INVALID_TRANSITION, { details: { from: state, event, allowed: machine.events(state) } });
    throw error;
  }
}
