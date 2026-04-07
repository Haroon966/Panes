import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatNpmSearchResults, formatPypiProjectJson } from './registrySearchTools.js';

describe('registrySearchTools formatters', () => {
  it('formats npm search results', () => {
    const data = {
      objects: [
        {
          package: {
            name: 'left-pad',
            version: '1.3.0',
            description: 'String left pad',
          },
        },
      ],
    };
    const s = formatNpmSearchResults(data, 'pad');
    assert.match(s, /left-pad/);
    assert.match(s, /1\.3\.0/);
    assert.match(s, /String left pad/);
  });

  it('formats empty npm search', () => {
    const s = formatNpmSearchResults({ objects: [] }, 'zzznonexistent999');
    assert.match(s, /No npm packages found/);
  });

  it('formats PyPI project JSON', () => {
    const data = {
      info: {
        name: 'requests',
        version: '2.31.0',
        summary: 'Python HTTP for Humans.',
        license: 'Apache 2.0',
        requires_python: '>=3.7',
        project_urls: { Homepage: 'https://requests.readthedocs.io' },
      },
    };
    const s = formatPypiProjectJson(data, 'requests');
    assert.match(s, /requests/);
    assert.match(s, /2\.31\.0/);
    assert.match(s, /Python HTTP/);
    assert.match(s, /readthedocs/);
  });
});
