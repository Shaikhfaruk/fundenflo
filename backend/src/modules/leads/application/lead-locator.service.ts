import { Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { GeoService } from '../../catalog/application/geo.service.js';

export type LocationInput = { cityId?: string; city?: string; pincode?: string };

export type ResolvedLocation = { stateId: string | null; cityId: string | null; pincode: string | null; text: string | null; unmapped: boolean };

@Injectable()
export class LeadLocator {
  constructor(private readonly geo: GeoService) {}

  async locate(input: LocationInput): Promise<ResolvedLocation> {
    const pincode = input.pincode ?? null;
    let cityId: string | null = null;
    let stateCode: string | null = null;
    let stateId: string | null = null;
    if (input.cityId) {
      const city = await this.geo.findActiveCity(input.cityId);
      if (!city) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'cityId', code: 'unknown_city', message: 'city not found' }] });
      cityId = city.id;
      stateCode = city.state.gstCode;
    }
    if (pincode && !cityId) {
      const place = await this.geo.pincode(pincode).catch((error: unknown) => {
        if (error instanceof AppError && error.code === ErrorCode.NOT_FOUND) return null;
        throw error;
      });
      if (place) {
        cityId = place.city?.id ?? null;
        stateCode = place.state.gstCode;
      }
    }
    let unmapped = false;
    if (!cityId && input.city) {
      const resolved = await this.geo.resolveCity(input.city);
      if (resolved) {
        cityId = resolved.cityId;
        stateId = resolved.stateId;
      } else {
        unmapped = true;
      }
    }
    if (!stateId && stateCode) stateId = (await this.geo.findActiveStates([stateCode]))[0]?.id ?? null;
    return { stateId, cityId, pincode, text: unmapped ? (input.city ?? null) : null, unmapped };
  }
}
