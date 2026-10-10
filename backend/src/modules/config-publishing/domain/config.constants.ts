import type { ConfigResource } from '../../../common/enums/db.enums.js';
import { MINUTE_MS } from '../../../common/constants/time.constants.js';

export const CONFIG_KEY_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)*$/;

export const CONFIG_KEY_MAX_LENGTH = 100;

export const MAX_CONFIG_CONTENT_BYTES = 512_000;

export const CONFIG_CACHE_TTL_SECONDS = 300;

export const PUBLISH_BACKDATE_TOLERANCE_MS = MINUTE_MS;

export const CONFIG_HANDLER_METADATA = 'config:handler';

export const CONFIG_VERSION_SUMMARY_LIMIT = 20;

export const configCacheTag = (resource: ConfigResource) => `config:${resource}`;
