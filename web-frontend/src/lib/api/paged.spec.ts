import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OPTION_MAX_PAGES, OPTION_PAGE_SIZE } from '@/lib/constants/http.constants';

import { apiRequest } from './client';
import { allPages } from './paged';

vi.mock('./client', () => ({ apiRequest: vi.fn() }));

const request = vi.mocked(apiRequest);

describe('allPages', () => {
  beforeEach(() => request.mockReset());

  it('follows the cursor until the last page', async () => {
    request.mockResolvedValueOnce({ items: [1, 2], nextCursor: 'c1' }).mockResolvedValueOnce({ items: [3], nextCursor: null });
    await expect(allPages<number>('GET /admin/lenders', { status: 'active' })).resolves.toEqual({ items: [1, 2, 3], nextCursor: null });
    expect(request).toHaveBeenNthCalledWith(1, 'GET /admin/lenders', { query: { status: 'active', cursor: undefined, limit: OPTION_PAGE_SIZE } });
    expect(request).toHaveBeenNthCalledWith(2, 'GET /admin/lenders', { query: { status: 'active', cursor: 'c1', limit: OPTION_PAGE_SIZE } });
  });

  it('stops at the page cap and keeps the cursor', async () => {
    request.mockResolvedValue({ items: [0], nextCursor: 'more' });
    const result = await allPages<number>('GET /admin/lenders');
    expect(request).toHaveBeenCalledTimes(OPTION_MAX_PAGES);
    expect(result).toEqual({ items: Array.from({ length: OPTION_MAX_PAGES }, () => 0), nextCursor: 'more' });
  });
});
