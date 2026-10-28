// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assertCreationEnabled,
  assertDestinationAllowed,
  CreationPausedError,
  DestinationBlockedError,
} from './policy';

vi.mock('server-only', () => ({}));
afterEach(() => vi.unstubAllEnvs());

describe('operator controls', () => {
  it('allows creation by default and supports an explicit pause', () => {
    vi.stubEnv('LINK_CREATION_ENABLED', undefined);
    expect(() => assertCreationEnabled()).not.toThrow();
    vi.stubEnv('LINK_CREATION_ENABLED', 'true');
    expect(() => assertCreationEnabled()).not.toThrow();
    vi.stubEnv('LINK_CREATION_ENABLED', 'false');
    expect(() => assertCreationEnabled()).toThrow(CreationPausedError);
    vi.stubEnv('LINK_CREATION_ENABLED', 'typo');
    expect(() => assertCreationEnabled()).toThrow('must be true or false');
  });

  it('allows destinations when no host is blocked', () => {
    vi.stubEnv('BLOCKED_LINK_HOSTS', '');
    expect(() =>
      assertDestinationAllowed('https://example.com/'),
    ).not.toThrow();
  });

  it.each([
    'https://blocked.example/path',
    'https://sub.blocked.example/',
    'https://BLOCKED.EXAMPLE./',
  ])('blocks exact hosts and subdomains: %s', (destination) => {
    vi.stubEnv('BLOCKED_LINK_HOSTS', ' Blocked.Example. , other.example ');
    expect(() => assertDestinationAllowed(destination)).toThrow(
      DestinationBlockedError,
    );
  });

  it.each([
    'https://notblocked.example/',
    'https://blocked.example.evil.test/',
    'https://example.com/blocked.example',
  ])('does not block unrelated hosts: %s', (destination) => {
    vi.stubEnv('BLOCKED_LINK_HOSTS', 'blocked.example');
    expect(() => assertDestinationAllowed(destination)).not.toThrow();
  });

  it('normalizes international hostnames', () => {
    vi.stubEnv('BLOCKED_LINK_HOSTS', 'bücher.example');
    expect(() =>
      assertDestinationAllowed('https://xn--bcher-kva.example/'),
    ).toThrow(DestinationBlockedError);
  });

  it.each([
    'https://example.com',
    'example.com/path',
    'user@example.com',
    '*.example.com',
    'example.com:443',
    '[::1]:443',
    'example.com,',
    'bad..example',
    'x'.repeat(4097),
  ])('fails closed on invalid operator host configuration: %s', (value) => {
    vi.stubEnv('BLOCKED_LINK_HOSTS', value);
    expect(() => assertDestinationAllowed('https://example.com/')).toThrow();
  });
});
