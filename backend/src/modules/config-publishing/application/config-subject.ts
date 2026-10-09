import { subject } from '@casl/ability';

import type { ConfigResource } from '../../../common/enums/db.enums.js';
import type { ConfigDocument } from '../../../generated/prisma/client.js';

export const configSubject = (resource: ConfigResource) => subject('ConfigDocument', { resource } as ConfigDocument);
