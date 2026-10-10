import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type { Redis } from 'ioredis';
import type { Server, ServerOptions } from 'socket.io';

export class RedisIoAdapter extends IoAdapter {
  private readonly publisher: Redis;

  private readonly subscriber: Redis;

  private readonly adapter: ReturnType<typeof createAdapter>;

  constructor(
    app: INestApplicationContext,
    redis: Redis,
    private readonly corsOrigins: string[],
  ) {
    super(app);
    this.publisher = redis.duplicate();
    this.subscriber = redis.duplicate();
    this.adapter = createAdapter(this.publisher, this.subscriber);
  }

  override createIOServer(port: number, options?: Partial<ServerOptions>): Server {
    const withCors = { ...options, cors: { origin: this.corsOrigins.length > 0 ? this.corsOrigins : false } } as ServerOptions;
    const server = super.createIOServer(port, withCors);
    server.adapter(this.adapter);
    return server;
  }

  override async dispose() {
    await this.subscriber.punsubscribe().catch(() => null);
    await this.subscriber.unsubscribe().catch(() => null);
    await Promise.all([this.publisher, this.subscriber].map(async (client) => {
      await client.quit().catch(() => client.disconnect());
    }));
  }
}
