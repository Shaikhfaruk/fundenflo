'use client';

import { useQuery } from '@tanstack/react-query';

import { Badge } from '@/components/ui/badge';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { segmentsQuery } from '@/lib/api/catalog';

export function SegmentList() {
  const { data, isPending, isError } = useQuery(segmentsQuery());
  if (isError) return null;
  if (isPending) return <div className="grid gap-3 sm:grid-cols-2">{[0, 1].map((key) => <Skeleton key={key} className="h-28 rounded-xl" />)}</div>;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {data.items.map((segment) => (
        <Card key={segment.key}>
          <CardHeader>
            <CardTitle>{segment.label}</CardTitle>
            {segment.description ? <CardDescription>{segment.description}</CardDescription> : null}
            <div className="flex flex-wrap gap-2 pt-2">
              {segment.subSegments.map((sub) => (
                <Badge key={sub.key} variant="secondary">
                  {sub.label}
                </Badge>
              ))}
            </div>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}
