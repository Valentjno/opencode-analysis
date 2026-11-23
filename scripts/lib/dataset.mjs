import { privacyFor, pricingOf, vendorName } from './opencode.mjs';

export function buildBaseModel({ id, goModel, allModel, goPageRow, freePrivacy }) {
  const source = goModel ?? allModel;
  if (!source) return null;

  const go = Boolean(goModel);
  const pricing = pricingOf(source);
  const free = pricing.input === 0 && pricing.output === 0;
  if (!go && !free) return null;

  const requests = goPageRow?.requests ?? {
    go: null,
    goPlus: null,
    goUnlimited: false,
    goPlusUnlimited: false,
  };

  return {
    id,
    name: source.name ?? id,
    canonicalId: source.canonical_id ?? null,
    vendor: vendorName(source.canonical_id, source.owned_by),
    description: source.description ?? '',
    family: source.family ?? null,
    openWeights: source.open_weights === true,
    releaseDate: source.release_date ?? null,
    lastUpdated: source.last_updated ?? null,
    knowledge: source.knowledge ?? null,
    access: {
      go,
      free,
      limitedRegions: goModel?.go?.limited_regions === true,
    },
    pricing,
    context: source.limit?.context ?? null,
    maxOutput: source.limit?.output ?? null,
    modalities: source.modalities ?? null,
    capabilities: source.capabilities ?? null,
    go: go
      ? {
          monthly: {
            go: goModel.go?.monthly_usage?.go ?? null,
            goPlus: goModel.go?.monthly_usage?.['go-plus'] ?? null,
            goTeams: goModel.go?.monthly_usage?.['go-teams'] ?? null,
          },
          requests5h: requests,
          featured: goModel.go?.featured === true,
        }
      : null,
    privacy: privacyFor(source, freePrivacy),
    aaSlug: null,
    aa: null,
    aaStatus: 'pending',
  };
}

export function sortModels(models) {
  return models.slice().sort((a, b) => {
    const aScore = a.aa?.intelligenceIndex ?? -1;
    const bScore = b.aa?.intelligenceIndex ?? -1;
    if (bScore !== aScore) return bScore - aScore;
    return a.name.localeCompare(b.name);
  });
}

export function computeStats(models) {
  const rated = models.filter(
    (model) =>
      model.aa?.intelligenceIndex !== null && model.aa?.intelligenceIndex !== undefined,
  );
  return {
    total: models.length,
    go: models.filter((model) => model.access.go).length,
    free: models.filter((model) => model.access.free).length,
    both: models.filter((model) => model.access.go && model.access.free).length,
    rated: rated.length,
    unrated: models.length - rated.length,
    private: models.filter(
      (model) => model.privacy?.training === false && model.privacy?.zdr === true,
    ).length,
    trains: models.filter((model) => model.privacy?.training === true).length,
    limitedRegions: models.filter((model) => model.access.limitedRegions).length,
  };
}

export function buildChanges(previous, models, at) {
  if (!previous?.models?.length) {
    return { baseline: true, events: [] };
  }

  const events = [];
  const before = new Map(previous.models.map((model) => [model.id, model]));
  const after = new Map(models.map((model) => [model.id, model]));

  const push = (type, model, message, extra = {}) => {
    events.push({ at, type, id: model.id, name: model.name, message, ...extra });
  };

  for (const model of models) {
    const old = before.get(model.id);
    if (!old) {
      push('added', model, `${model.name} was added to ${model.access.go ? 'Go' : 'the free tier'}.`);
      continue;
    }

    if (old.pricing.input !== model.pricing.input || old.pricing.output !== model.pricing.output) {
      push(
        'price',
        model,
        `${model.name} price changed from $${old.pricing.input}/$${old.pricing.output} to $${model.pricing.input}/$${model.pricing.output} per 1M tokens.`,
        { field: 'price', from: old.pricing, to: model.pricing },
      );
    }

    if (old.access.free !== model.access.free) {
      push(
        'access',
        model,
        model.access.free ? `${model.name} is now free.` : `${model.name} is no longer free.`,
        { field: 'free', from: old.access.free, to: model.access.free },
      );
    }

    const oldMonthly = old.go?.monthly?.go ?? null;
    const newMonthly = model.go?.monthly?.go ?? null;
    if (oldMonthly !== newMonthly) {
      push(
        'allowance',
        model,
        `${model.name} Go monthly allowance changed from ${oldMonthly === null ? '—' : `$${oldMonthly}`} to ${newMonthly === null ? '—' : `$${newMonthly}`}.`,
        { field: 'monthly.go', from: oldMonthly, to: newMonthly },
      );
    }

    const oldRequests = old.go?.requests5h?.go ?? null;
    const newRequests = model.go?.requests5h?.go ?? null;
    if (oldRequests !== newRequests) {
      push(
        'requests',
        model,
        `${model.name} Go rate allowance changed from ${oldRequests ?? '∞'} to ${newRequests ?? '∞'} requests / 5h.`,
        { field: 'requests5h.go', from: oldRequests, to: newRequests },
      );
    }

    const oldPrivacy = `${old.privacy?.training}|${old.privacy?.zdr}`;
    const newPrivacy = `${model.privacy?.training}|${model.privacy?.zdr}`;
    if (oldPrivacy !== newPrivacy) {
      push('privacy', model, `${model.name} privacy terms changed.`, {
        field: 'privacy',
        from: { training: old.privacy?.training, zdr: old.privacy?.zdr },
        to: { training: model.privacy?.training, zdr: model.privacy?.zdr },
      });
    }

    const oldScore = old.aa?.intelligenceIndex ?? null;
    const newScore = model.aa?.intelligenceIndex ?? null;
    if (oldScore !== newScore) {
      if (oldScore === null && newScore !== null) {
        push('rated', model, `${model.name} was rated by Artificial Analysis: ${newScore}.`);
      } else if (oldScore !== null && newScore === null) {
        push('unrated', model, `${model.name} no longer has an Artificial Analysis score.`);
      } else {
        push(
          'score',
          model,
          `${model.name} Intelligence Index changed from ${oldScore} to ${newScore}.`,
          { field: 'aa.intelligenceIndex', from: oldScore, to: newScore },
        );
      }
    }
  }

  for (const model of previous.models) {
    if (!after.has(model.id)) {
      push('removed', model, `${model.name} was removed.`);
    }
  }

  return { baseline: false, events };
}

export function mergeChanges({ previousChanges, baseline, events, at }) {
  if (baseline) {
    return { schemaVersion: 1, updatedAt: at, baseline: true, events: [] };
  }

  const seen = new Set();
  const merged = [...events, ...(previousChanges?.events ?? [])].filter((event) => {
    const key = `${event.at}|${event.type}|${event.id}|${event.field ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    schemaVersion: 1,
    updatedAt: at,
    baseline: false,
    events: merged.slice(0, 500),
  };
}
