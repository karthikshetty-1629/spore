function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be an object`);
}

function text(value, name, max = 500) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new TypeError(`${name} must be a non-empty string under ${max} characters`);
  return value.trim();
}

export function validateAgentPlan(value) {
  object(value, 'agent plan');
  if (value.schema_version !== 1) throw new TypeError('agent plan schema_version must equal 1');
  const objective = text(value.objective, 'agent plan objective');
  const subject = text(value.subject, 'agent plan subject', 120);
  if (!Array.isArray(value.search_queries) || value.search_queries.length < 2 || value.search_queries.length > 3) {
    throw new TypeError('agent plan must contain 2 or 3 search queries');
  }
  const search_queries = [...new Set(value.search_queries.map((query) => text(query, 'search query', 180)))];
  if (search_queries.length < 2) throw new TypeError('agent plan search queries must be distinct');
  if (!Array.isArray(value.official_domains) || value.official_domains.length < 1 || value.official_domains.length > 4) {
    throw new TypeError('agent plan must contain 1 to 4 official domains');
  }
  const official_domains = [...new Set(value.official_domains.map((domain) => {
    const raw = text(domain, 'official domain', 200).toLowerCase();
    try {
      return new URL(raw.includes('://') ? raw : `https://${raw}`).hostname.replace(/^www\./, '');
    } catch {
      throw new TypeError('agent plan contains an invalid official domain');
    }
  }))];
  for (const domain of official_domains) {
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) throw new TypeError('agent plan contains an invalid official domain');
  }
  object(value.wake_condition, 'agent plan wake_condition');
  const wake_condition = {
    attribute: text(value.wake_condition.attribute, 'wake attribute', 80),
    operator: value.wake_condition.operator,
    target: value.wake_condition.target,
  };
  if (wake_condition.operator !== '==' || wake_condition.target !== true) {
    throw new TypeError('this autonomous demo supports an == true availability condition');
  }
  return { schema_version: 1, objective, subject, search_queries, official_domains, wake_condition };
}

export function validateEvidenceAssessment(value, results, officialDomains) {
  object(value, 'evidence assessment');
  if (value.schema_version !== 1) throw new TypeError('evidence assessment schema_version must equal 1');
  if (typeof value.condition_met !== 'boolean') throw new TypeError('evidence assessment condition_met must be boolean');
  const summary = text(value.summary, 'evidence assessment summary', 600);
  if (!Array.isArray(value.matched_urls) || value.matched_urls.length > 5) throw new TypeError('evidence assessment matched_urls must be an array');
  const resultUrls = new Set(results.map((item) => item.url));
  const matched_urls = [...new Set(value.matched_urls.map((url) => text(url, 'matched URL', 1000)))];
  for (const url of matched_urls) {
    if (!resultUrls.has(url)) throw new TypeError('Liquid cited a URL that was not returned by Nimble');
    const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    if (!officialDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))) {
      throw new TypeError('Liquid cited a source outside the official-domain policy');
    }
  }
  if (value.condition_met && matched_urls.length === 0) throw new TypeError('a positive assessment requires an official cited source');
  return { schema_version: 1, condition_met: value.condition_met, matched_urls, summary };
}
