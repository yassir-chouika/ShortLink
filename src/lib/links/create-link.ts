import 'server-only';
import { randomBytes } from 'node:crypto';
import { Prisma } from '@/generated/prisma/client';
import { getDb } from '@/lib/db';
import { CodeAllocationError } from './errors';

export type CreatedLink = {
  id: string;
  code: string;
  destinationUrl: string;
  createdAt: Date;
};

type LinkData = Pick<CreatedLink, 'code' | 'destinationUrl'>;
type CreationDependencies = {
  generateCode?: () => string;
  persist?: (data: LinkData) => Promise<CreatedLink>;
};

function generateCode(): string {
  // Six random bytes encode as eight URL-safe characters without padding.
  return randomBytes(6).toString('base64url');
}

function persist(data: LinkData): Promise<CreatedLink> {
  return getDb().link.create({
    data,
    select: { id: true, code: true, destinationUrl: true, createdAt: true },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isCodeCollision(error: unknown): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== 'P2002'
  ) {
    return false;
  }

  const target = error.meta?.target;
  if (Array.isArray(target)) return target.length === 1 && target[0] === 'code';

  // The pg adapter reports the index inside its cause, rather than meta.target.
  const adapterError = error.meta?.driverAdapterError;
  if (!isRecord(adapterError) || !isRecord(adapterError.cause)) return false;
  const constraint = adapterError.cause.constraint;
  return (
    adapterError.cause.kind === 'UniqueConstraintViolation' &&
    isRecord(constraint) &&
    constraint.index === 'Link_code_key'
  );
}

/** Persist a validated destination; let the unique index arbitrate collisions. */
export async function createLink(
  destinationUrl: string,
  dependencies: CreationDependencies = {},
): Promise<CreatedLink> {
  const nextCode = dependencies.generateCode ?? generateCode;
  const save = dependencies.persist ?? persist;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await save({ code: nextCode(), destinationUrl });
    } catch (error) {
      if (!isCodeCollision(error)) throw error;
    }
  }

  throw new CodeAllocationError();
}
