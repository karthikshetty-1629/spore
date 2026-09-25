export function evaluateWakeCondition(condition, facts) {
  const actual = facts?.[condition.attribute];
  if (actual === undefined) {
    return { matched: false, actual: null, reason: `${condition.attribute} was not observed` };
  }

  if (condition.operator === '==') {
    const matched = Object.is(actual, condition.target);
    return { matched, actual, reason: matched ? 'exact value matched' : 'exact value did not match' };
  }
  if (condition.operator === '<=') {
    const matched = Number.isFinite(actual)
      && Number.isFinite(condition.target)
      && actual <= condition.target;
    return { matched, actual, reason: matched ? 'numeric threshold matched' : 'numeric threshold did not match' };
  }
  throw new TypeError(`unsupported wake operator: ${condition.operator}`);
}

export function extractFactsFromSearch(spore, results) {
  const facts = {};
  const evidenceUrls = [];

  if (spore.wake_condition.attribute === 'public_api_available') {
    const negative = /\b(no|without|not yet|unavailable|does not (offer|provide|have))\b.{0,40}\b(public |developer )?api\b/i;
    const positive = /(launch(ed)?|announc(ed)?|introduc(ed)?|release(d)?|now available|documentation).{0,60}(developer platform|public api|developer api)|(developer platform|public api|developer api).{0,60}(launch(ed)?|announc(ed)?|introduc(ed)?|release(d)?|now available|documentation)/i;
    const matching = results.filter((item) => {
      const text = `${item.title} ${item.description}`;
      return positive.test(text) && !negative.test(text);
    });
    facts.public_api_available = matching.length > 0;
    evidenceUrls.push(...matching.map((item) => item.url));
  }

  if (spore.wake_condition.attribute === 'api_documentation_available') {
    const matching = results.filter((item) => {
      const text = `${item.title} ${item.description}`;
      return /\b(api|developer)\b/i.test(text) && /\b(documentation|docs|reference)\b/i.test(text);
    });
    facts.api_documentation_available = matching.length > 0;
    evidenceUrls.push(...matching.map((item) => item.url));
  }

  if (spore.wake_condition.attribute === 'monthly_price') {
    const prices = [];
    for (const item of results) {
      const text = `${item.title} ${item.description}`;
      for (const match of text.matchAll(/\$\s*([0-9]+(?:\.[0-9]{1,2})?)/g)) {
        prices.push(Number(match[1]));
        evidenceUrls.push(item.url);
      }
    }
    if (prices.length) facts.monthly_price = Math.min(...prices);
  }

  return { facts, evidence_urls: [...new Set(evidenceUrls)] };
}
