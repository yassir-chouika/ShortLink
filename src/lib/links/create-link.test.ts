import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@/generated/prisma/client';
import { createLink, type CreatedLink } from './create-link';
import { CodeAllocationError } from './errors';

vi.mock('server-only', () => ({}));

const destinationUrl = 'https://example.com/article';
const baseRecord = {
  id: '94d1b2e4-61ac-42f1-8b59-c94aad7e819a',
  createdAt: new Date('2026-10-28T00:00:00Z'),
};

function collision(target = 'code') {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '7.10.1',
    meta: { target: [target] },
  });
}

function adapterCollision(index = 'Link_code_key') {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '7.10.1',
    meta: {
      driverAdapterError: {
        cause: { kind: 'UniqueConstraintViolation', constraint: { index } },
      },
    },
  });
}

describe('short-link creation', () => {
  it('generates an eight-character URL-safe code and persists the destination', async () => {
    const persist = vi.fn(
      async (data: Pick<CreatedLink, 'code' | 'destinationUrl'>) => ({
        ...baseRecord,
        ...data,
      }),
    );

    const result = await createLink(destinationUrl, { persist });

    expect(result.code).toMatch(/^[A-Za-z0-9_-]{8}$/);
    expect(persist).toHaveBeenCalledExactlyOnceWith({
      code: result.code,
      destinationUrl,
    });
  });

  it.each([collision(), adapterCollision()])(
    'generates a new code after a database short-code collision',
    async (error) => {
      const generateCode = vi
        .fn()
        .mockReturnValueOnce('taken123')
        .mockReturnValueOnce('fresh456');
      const persist = vi
        .fn(async (data: Pick<CreatedLink, 'code' | 'destinationUrl'>) => ({
          ...baseRecord,
          ...data,
        }))
        .mockRejectedValueOnce(error);

      const result = await createLink(destinationUrl, {
        persist,
        generateCode,
      });

      expect(result.code).toBe('fresh456');
      expect(persist).toHaveBeenNthCalledWith(1, {
        code: 'taken123',
        destinationUrl,
      });
      expect(persist).toHaveBeenNthCalledWith(2, {
        code: 'fresh456',
        destinationUrl,
      });
    },
  );

  it.each([collision(), adapterCollision()])(
    'stops after five code collisions',
    async (error) => {
      const persist = vi.fn().mockRejectedValue(error);

      await expect(
        createLink(destinationUrl, { persist }),
      ).rejects.toBeInstanceOf(CodeAllocationError);
      expect(persist).toHaveBeenCalledTimes(5);
    },
  );

  it.each([
    new Error('Database unavailable'),
    collision('id'),
    adapterCollision('Link_pkey'),
    new Prisma.PrismaClientKnownRequestError('Unknown unique constraint', {
      code: 'P2002',
      clientVersion: '7.10.1',
    }),
  ])('does not retry unrelated database failures', async (error) => {
    const persist = vi.fn().mockRejectedValue(error);

    await expect(createLink(destinationUrl, { persist })).rejects.toBe(error);
    expect(persist).toHaveBeenCalledTimes(1);
  });
});
