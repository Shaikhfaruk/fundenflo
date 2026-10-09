import { Injectable } from '@nestjs/common';

import { ContactType } from '../../../common/enums/db.enums.js';
import { maskEmail, maskMobile } from '../../../engines/party-matching/mask.js';
import { BlindIndex } from '../../../infrastructure/crypto/blind-index.service.js';
import { type CipherPurpose } from '../../../infrastructure/crypto/crypto.constants.js';
import { FieldCipher } from '../../../infrastructure/crypto/field-cipher.service.js';
import { CONTACT_INDEX_DOMAIN } from '../domain/party.constants.js';

export type EncodedContact = {
  hash: string;
  encrypted: string;
  masked: string;
};

@Injectable()
export class ContactCodec {
  constructor(
    private readonly blindIndex: BlindIndex,
    private readonly cipher: FieldCipher,
  ) {}

  hash(type: ContactType, normalisedValue: string): string {
    return this.blindIndex.hash(CONTACT_INDEX_DOMAIN[type], normalisedValue);
  }

  mask(type: ContactType, normalisedValue: string): string {
    return type === ContactType.email ? maskEmail(normalisedValue) : maskMobile(normalisedValue);
  }

  encode(type: ContactType, normalisedValue: string, purpose: CipherPurpose): EncodedContact {
    return {
      hash: this.hash(type, normalisedValue),
      encrypted: this.cipher.encrypt(normalisedValue, purpose),
      masked: this.mask(type, normalisedValue),
    };
  }

  decrypt(encrypted: string, purpose: CipherPurpose): string {
    return this.cipher.decrypt(encrypted, purpose);
  }
}
