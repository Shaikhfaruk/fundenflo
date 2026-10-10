import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type { Redis } from 'ioredis';
import type { Server, ServerOptions } from 'socket.io';

export class RedisIoAdapter extends IoAdapter {
  private readonly clients: Redis[];

  private readonly adapter: ReturnType<typeof createAdapter>;

  constructor(
    app: INestApplicationContext,
    redis: Redis,
    private readonly corsOrigins: string[],
  ) {
    super(app);
    const publisher = redis.duplicate();
    const subscriber = redis.duplicate();
    this.clients = [publisher, subscriber];
    this.adapter = createAdapter(publisher, subscriber);
  }

  override createIOServer(port: number, options?: Partial<ServerOptions>): Server {
    const withCors = { ...options, cors: { origin: this.corsOrigins.length > 0 ? this.corsOrigins : false } } as ServerOptions;
    const server = super.createIOServer(port, withCors);
    server.adapter(this.adapter);
    return server;
  }

  override async dispose() {
    await Promise.all(this.clients.map((client) => client.quit()));
  }
}
