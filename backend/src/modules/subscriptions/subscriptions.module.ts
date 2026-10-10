import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';

import { AuthModule } from '../auth/auth.module.js';
import { SubscriptionTargetRegistry } from './application/subscription-target.registry.js';
import { SubscriptionService } from './application/subscription.service.js';
import { NotificationSubscriptionsController } from './http/notification-subscriptions.controller.js';
import { SubscriptionDeliveryProcessor } from './infrastructure/subscription-delivery.processor.js';
import { SubscriptionRepository } from './infrastructure/subscription.repository.js';

export const SUBSCRIPTION_PROCESSORS = [SubscriptionDeliveryProcessor];

@Module({
  imports: [AuthModule, DiscoveryModule],
  controllers: [NotificationSubscriptionsController],
  providers: [SubscriptionRepository, SubscriptionTargetRegistry, SubscriptionService],
  exports: [SubscriptionService],
})
export class SubscriptionsModule {}
