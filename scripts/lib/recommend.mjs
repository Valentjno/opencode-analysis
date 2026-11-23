/**
 * Deterministic recommendation rules.
 *
 * The universe is every model with a numeric Artificial Analysis Intelligence
 * Index. Each rule is a sentence a reader can verify against the documented
 * values; ties are broken deterministically so two refreshes on unchanged data
 * produce identical picks. Constants are mirrored on the methodology page.
 */

export const RULES = {
  planner: 'Highest Artificial Analysis Intelligence Index overall.',
  builder:
    'Cheaper than the planner and within 10 Intelligence Index points of it; highest intelligence per dollar.',
  medium:
    'Highest Intelligence Index among models at or below the median blended price of rated models.',
  cheapest: 'Lowest blended price among models with an Intelligence Index of at least 25.',
  private:
    'Not training on requests, zero data retention, and an Intelligence Index of at least 30.',
};

export const MIN_BUILDER_GAP = 10;
export const MIN_CHEAP_CAPABLE = 25;
export const MIN_PRIVATE_SCORE = 30;

const priceOf = (model) => {
  const value = model?.pricing?.blended;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

const scoreOf = (model) => {
  const value = model?.aa?.intelligenceIndex;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

const byId = (a, b) => String(a.id).localeCompare(String(b.id));

/** Null prices sort last; otherwise ascending. */
function comparePriceAsc(a, b) {
  const pa = priceOf(a);
  const pb = priceOf(b);
  if (pa === null && pb === null) return byId(a, b);
  if (pa === null) return 1;
  if (pb === null) return -1;
  return pa - pb || byId(a, b);
}

/** Higher score first; null last. */
function compareScoreDesc(a, b) {
  const sa = scoreOf(a);
  const sb = scoreOf(b);
  if (sa === null && sb === null) return byId(a, b);
  if (sa === null) return 1;
  if (sb === null) return -1;
  return sb - sa || comparePriceAsc(a, b);
}

export function medianPrice(models) {
  const prices = models.map(priceOf).filter((value) => value !== null).sort((a, b) => a - b);
  if (prices.length === 0) return null;
  const middle = Math.floor(prices.length / 2);
  return prices.length % 2 === 1 ? prices[middle] : (prices[middle - 1] + prices[middle]) / 2;
}

function privacyCaveat(model) {
  const training = model?.privacy?.training;
  if (training === true) {
    return 'OpenCode lists this model as training on requests. Do not send sensitive data.';
  }
  if (training === null || training === undefined) {
    return 'Privacy terms for this model are not documented. Check the OpenCode docs before sending sensitive data.';
  }
  if (model?.privacy?.zdr !== true) {
    return 'Not zero-retention according to the published terms.';
  }
  return null;
}

function pick(slot, title, model, rule, reason, caveat) {
  return {
    slot,
    title,
    modelId: model?.id ?? null,
    rule,
    reason,
    caveat: caveat ?? null,
    intelligenceIndex: scoreOf(model),
    blendedPrice: priceOf(model),
    monthlyGo: model?.go?.monthly?.go ?? null,
  };
}

function empty(slot, title, rule, reason) {
  return {
    slot,
    title,
    modelId: null,
    rule,
    reason,
    caveat: null,
    intelligenceIndex: null,
    blendedPrice: null,
    monthlyGo: null,
  };
}

export function recommend(models) {
  const rated = models.filter((model) => scoreOf(model) !== null);

  if (rated.length < 2) {
    const reason = `Only ${rated.length} rated model${rated.length === 1 ? '' : 's'} in the catalog. At least two are required for a meaningful comparison.`;
    return {
      planner: empty('planner', 'Best planner', RULES.planner, reason),
      builder: empty('builder', 'Best cheap builder', RULES.builder, reason),
      medium: empty('medium', 'Best for medium tasks', RULES.medium, reason),
      cheapest: empty('cheapest', 'Cheapest capable', RULES.cheapest, reason),
      private: empty('private', 'Most private', RULES.private, reason),
    };
  }

  const ranked = rated.slice().sort(compareScoreDesc);
  const planner = ranked[0];
  const plannerScore = scoreOf(planner);
  const plannerPrice = priceOf(planner);

  const plannerPick = pick(
    'planner',
    'Best planner',
    planner,
    RULES.planner,
    `Highest Intelligence Index in the catalog at ${plannerScore}.`,
    privacyCaveat(planner),
  );

  const builderCandidates = ranked.filter((model) => {
    const score = scoreOf(model);
    const price = priceOf(model);
    if (price === null || plannerPrice === null) return false;
    if (price >= plannerPrice) return false;
    return score >= plannerScore - MIN_BUILDER_GAP;
  });

  const builder = builderCandidates
    .slice()
    .sort((a, b) => {
      const ratioA = scoreOf(a) / (1 + priceOf(a));
      const ratioB = scoreOf(b) / (1 + priceOf(b));
      if (ratioB !== ratioA) return ratioB - ratioA;
      return compareScoreDesc(a, b);
    })[0];

  const builderPick = builder
    ? pick(
        'builder',
        'Best cheap builder',
        builder,
        RULES.builder,
        `${scoreOf(builder)} Intelligence Index at $${priceOf(builder)} blended per 1M tokens, versus ${plannerScore} at $${plannerPrice} for the planner.`,
        privacyCaveat(builder),
      )
    : empty(
        'builder',
        'Best cheap builder',
        RULES.builder,
        plannerPrice === null
          ? 'The planner has no published blended price, so no cheaper alternative can be compared.'
          : `No other rated model is cheaper than $${plannerPrice} and within ${MIN_BUILDER_GAP} Intelligence Index points of the planner.`,
      );

  const median = medianPrice(rated);
  const mediumCandidates =
    median === null ? [] : ranked.filter((model) => {
      const price = priceOf(model);
      return price !== null && price <= median;
    });
  const medium = mediumCandidates[0];
  const mediumPick = medium
    ? pick(
        'medium',
        'Best for medium tasks',
        medium,
        RULES.medium,
        `${scoreOf(medium)} Intelligence Index at $${priceOf(medium)} blended, at or below the rated median of $${median}.`,
        privacyCaveat(medium),
      )
    : empty(
        'medium',
        'Best for medium tasks',
        RULES.medium,
        median === null
          ? 'No rated model has a published blended price, so no median can be computed.'
          : 'No rated model with a published price is at or below the median.',
      );

  const cheapestCandidates = ranked
    .filter((model) => scoreOf(model) >= MIN_CHEAP_CAPABLE && priceOf(model) !== null)
    .sort(comparePriceAsc);
  const cheapest = cheapestCandidates[0];
  const cheapestPick = cheapest
    ? pick(
        'cheapest',
        'Cheapest capable',
        cheapest,
        RULES.cheapest,
        `$${priceOf(cheapest)} blended per 1M tokens with an Intelligence Index of ${scoreOf(cheapest)}.`,
        privacyCaveat(cheapest),
      )
    : empty(
        'cheapest',
        'Cheapest capable',
        RULES.cheapest,
        `No rated model reaches an Intelligence Index of ${MIN_CHEAP_CAPABLE} with a published price.`,
      );

  const strictPrivate = ranked
    .filter(
      (model) =>
        model?.privacy?.training === false &&
        model?.privacy?.zdr === true &&
        scoreOf(model) >= MIN_PRIVATE_SCORE,
    )
    .sort(compareScoreDesc)[0];

  const relaxedPrivate = strictPrivate
    ? null
    : ranked
        .filter(
          (model) => model?.privacy?.training === false && scoreOf(model) >= MIN_PRIVATE_SCORE,
        )
        .sort(compareScoreDesc)[0];

  const privateModel = strictPrivate ?? relaxedPrivate ?? null;
  const privatePick = privateModel
    ? pick(
        'private',
        'Most private',
        privateModel,
        RULES.private,
        strictPrivate
          ? `${scoreOf(privateModel)} Intelligence Index with no training on requests and zero data retention.`
          : `${scoreOf(privateModel)} Intelligence Index with no training on requests.`,
        strictPrivate
          ? null
          : 'No model meets every privacy condition, so this is the best no-training option. It is not zero-retention.',
      )
    : empty(
        'private',
        'Most private',
        RULES.private,
        `No rated model has documented no-training terms and an Intelligence Index of at least ${MIN_PRIVATE_SCORE}.`,
      );

  return {
    planner: plannerPick,
    builder: builderPick,
    medium: mediumPick,
    cheapest: cheapestPick,
    private: privatePick,
  };
}
