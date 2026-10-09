CREATE INDEX "sla_timers_pending_due" ON "sla_timers" ("due_at") WHERE "status" = 'pending';

CREATE INDEX "sla_timers_pending_warn" ON "sla_timers" ("warn_at") WHERE "status" = 'pending' AND "warned_at" IS NULL;
