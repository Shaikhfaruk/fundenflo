import type { Type } from '@nestjs/common';
import type { DiscoveryService, Reflector } from '@nestjs/core';

export function collectKeyedProviders<K, T>(discovery: DiscoveryService, reflector: Reflector, metadataKey: string): Map<K, T> {
  const found = new Map<K, T>();
  for (const wrapper of discovery.getProviders()) {
    if (!wrapper.metatype || wrapper.isNotMetatype || !wrapper.instance) continue;
    const key = reflector.get<K | undefined>(metadataKey, wrapper.metatype as Type);
    if (key === undefined) continue;
    if (found.has(key)) throw new Error(`More than one provider is registered for ${String(key)} (${metadataKey})`);
    found.set(key, wrapper.instance as T);
  }
  return found;
}
