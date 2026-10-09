import { applyDecorators, Injectable, SetMetadata } from '@nestjs/common';

import type { ConfigResource } from '../../../common/enums/db.enums.js';
import { CONFIG_HANDLER_METADATA } from '../domain/config.constants.js';

export const ConfigHandler = (resource: ConfigResource) => applyDecorators(Injectable(), SetMetadata(CONFIG_HANDLER_METADATA, resource));
