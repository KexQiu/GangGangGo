import { describe, expect, it } from 'vitest';

import { createOpenApiDocument } from './openapiDocument.js';

describe('OpenAPI document', () => {
  it('matches the registered route and contract schema snapshot', () => {
    expect(createOpenApiDocument()).toMatchSnapshot();
  });
});
