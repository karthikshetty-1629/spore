export class NimbleSearchClient {
  constructor({ apiKey, baseUrl = 'https://sdk.nimbleway.com', fetchImpl = fetch }) {
    if (typeof apiKey !== 'string' || apiKey.trim() === '') throw new TypeError('Nimble API key is required');
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.fetchImpl = fetchImpl;
    this.mode = 'live';
  }

  async search({ query, maxResults = 3, searchDepth = 'lite' }) {
    if (typeof query !== 'string' || query.trim() === '') throw new TypeError('search query is required');
    if (!Number.isInteger(maxResults) || maxResults < 1 || maxResults > 10) {
      throw new TypeError('maxResults must be an integer from 1 to 10');
    }
    if (!new Set(['lite', 'standard', 'deep']).has(searchDepth)) {
      throw new TypeError('searchDepth is invalid');
    }

    const response = await this.fetchImpl(`${this.baseUrl}/v2/search`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: query.trim(),
        max_results: maxResults,
        search_depth: searchDepth,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`Nimble search returned HTTP ${response.status}`);
    const payload = await response.json();
    if (!Array.isArray(payload.results)) throw new Error('Nimble search response did not contain results');

    return payload.results.flatMap((item) => {
      if (!item || typeof item.url !== 'string' || !/^https?:\/\//.test(item.url)) return [];
      return [{
        title: typeof item.title === 'string' ? item.title : '',
        url: item.url,
        description: typeof item.description === 'string'
          ? item.description
          : typeof item.snippet === 'string' ? item.snippet : '',
      }];
    });
  }
}
