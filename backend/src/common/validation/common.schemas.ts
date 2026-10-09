import { z } from 'zod';

import { DevicePlatform } from '../enums/device-platform.enum.js';
import { SUPPORTED_LOCALES } from '../i18n/locale.js';

export const uuidSchema = z.uuid();

export const deviceSchema = z
  .object({
    id: z.string().trim().min(1).max(128).optional(),
    name: z.string().trim().min(1).max(100).optional(),
    platform: z.enum(Object.values(DevicePlatform)).optional(),
  })
  .strict();

export type DeviceInput = z.output<typeof deviceSchema>;

export const otpCodeSchema = z.string().regex(/^\d{6}$/, 'must be 6 digits');

export const personNameSchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[\p{L}][\p{L} .'-]*$/u, 'use letters, spaces, dots, apostrophes or hyphens')
  .transform((value) => value.replace(/\s+/g, ' '));

export const localeSchema = z.enum(SUPPORTED_LOCALES);
