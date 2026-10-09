import { Inject } from '@nestjs/common';

export const APP_CONFIG = Symbol('APP_CONFIG');

export const InjectConfig = () => Inject(APP_CONFIG);
