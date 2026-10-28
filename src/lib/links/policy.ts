import 'server-only';
import { isIP } from 'node:net';

export class CreationPausedError extends Error {
  readonly name = 'CreationPausedError';
}

export class DestinationBlockedError extends Error {
  readonly name = 'DestinationBlockedError';
}

export function assertCreationEnabled(): void {
  const value = process.env.LINK_CREATION_ENABLED;
  if (value === 'false') throw new CreationPausedError();
  if (value !== undefined && value !== 'true') {
    throw new Error('LINK_CREATION_ENABLED must be true or false.');
  }
}

function canonicalHost(host: string): string {
  const parsed = new URL(`https://${host}`);
  if (
    parsed.username ||
    parsed.password ||
    parsed.port ||
    parsed.pathname !== '/' ||
    parsed.search ||
    parsed.hash ||
    /[\s\\/?#@]/.test(host) ||
    host.endsWith(':')
  ) {
    throw new Error('BLOCKED_LINK_HOSTS must contain only hostnames.');
  }
  // Explicit default ports are normalized away by URL, so reject them as input.
  if (
    (!host.startsWith('[') && host.includes(':')) ||
    (host.startsWith('[') && !host.endsWith(']'))
  ) {
    throw new Error('BLOCKED_LINK_HOSTS must contain only hostnames.');
  }
  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '');
  const address = hostname.startsWith('[') ? hostname.slice(1, -1) : hostname;
  if (
    !isIP(address) &&
    (hostname.length > 253 ||
      hostname
        .split('.')
        .some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)))
  ) {
    throw new Error('BLOCKED_LINK_HOSTS must contain only hostnames.');
  }
  return hostname;
}

/** Operator-managed exact hosts and their subdomains; no remote scanning API. */
export function assertDestinationAllowed(destination: string): void {
  const value = process.env.BLOCKED_LINK_HOSTS;
  if (!value) return;
  if (value.length > 4096) throw new Error('BLOCKED_LINK_HOSTS is too long.');
  const hosts = value.split(',').map((host) => host.trim());
  if (hosts.length > 50 || hosts.some((host) => !host || host.includes('*'))) {
    throw new Error('BLOCKED_LINK_HOSTS must contain at most 50 hostnames.');
  }
  const blocked = hosts.map(canonicalHost);
  const hostname = new URL(destination).hostname
    .toLowerCase()
    .replace(/\.$/, '');
  if (
    blocked.some((host) => hostname === host || hostname.endsWith(`.${host}`))
  ) {
    throw new DestinationBlockedError();
  }
}
