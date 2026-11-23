import type { Model } from './types';

export interface FrontierPoint {
  model: Model;
  score: number;
  price: number;
}

export interface AllowancePoint {
  model: Model;
  score: number;
  allowance: number;
}

interface Point {
  model: Model;
  score: number;
  x: number;
}

/**
 * Non-dominated set for intelligence vs price: model A dominates B when
 * A.score >= B.score and A.price <= B.price with at least one strict
 * inequality. Unrated models and models without a blended price are excluded
 * because they cannot be placed on the plane.
 */
export function priceFrontier(models: Model[]): FrontierPoint[] {
  const points: Point[] = [];
  for (const model of models) {
    const score = model.aa?.intelligenceIndex;
    const price = model.pricing.blended;
    if (typeof score === 'number' && typeof price === 'number') {
      points.push({ model, score, x: price });
    }
  }

  const frontier = points.filter(
    (point) =>
      !points.some(
        (other) =>
          other !== point &&
          other.score >= point.score &&
          other.x <= point.x &&
          (other.score > point.score || other.x < point.x),
      ),
  );

  return frontier
    .map((point) => ({ model: point.model, score: point.score, price: point.x }))
    .sort((a, b) => a.price - b.price || b.score - a.score);
}

/**
 * Non-dominated set for intelligence vs monthly Go allowance, where more
 * allowance is better. Models without a numeric monthly Go allowance are
 * excluded; unlimited request caps are listed separately by the view.
 */
export function allowanceFrontier(models: Model[]): AllowancePoint[] {
  const points: Point[] = [];
  for (const model of models) {
    const score = model.aa?.intelligenceIndex;
    const allowance = model.go?.monthly?.go;
    if (typeof score === 'number' && typeof allowance === 'number') {
      points.push({ model, score, x: allowance });
    }
  }

  const frontier = points.filter(
    (point) =>
      !points.some(
        (other) =>
          other !== point &&
          other.score >= point.score &&
          other.x >= point.x &&
          (other.score > point.score || other.x > point.x),
      ),
  );

  return frontier
    .map((point) => ({ model: point.model, score: point.score, allowance: point.x }))
    .sort((a, b) => b.allowance - a.allowance || b.score - a.score);
}

export function unlimitedRequestModels(models: Model[]): Model[] {
  return models.filter((model) => model.go?.requests5h.goUnlimited === true);
}
