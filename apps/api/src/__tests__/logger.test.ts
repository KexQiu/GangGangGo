import { Writable } from 'node:stream';

import { describe, expect, it } from 'vitest';

import { createLogger } from '../lib/logger.js';

describe('logger redaction', () => {
  it('redacts authentication, health, and Watch payload fields', () => {
    let output = '';
    const destination = new Writable({
      write(chunk, _encoding, callback) {
        output += chunk.toString();
        callback();
      },
    });
    const logger = createLogger({ LOG_LEVEL: 'info', NODE_ENV: 'test' }, destination);
    const secret = 'must-not-appear';

    logger.info(
      {
        accessToken: secret,
        body: { note: secret },
        err: { message: secret, stack: secret },
        nested: { token: secret },
        req: { headers: { authorization: `Bearer ${secret}` } },
        watchPayload: { symptoms: secret },
      },
      'redaction test',
    );

    expect(output).not.toContain(secret);
    expect(output).toContain('[Redacted]');
  });
});
