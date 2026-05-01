import type { RatingBreakdown } from "../types/domain";

export function defaultRatings(base: number): RatingBreakdown {
  const value = Number(Math.min(4.9, Math.max(3.6, base)).toFixed(1));

  return {
    food: value,
    drink: value,
    wifi: value,
    ambience: value,
    workFriendly: value,
    value,
  };
}

export function averageRating(ratings: RatingBreakdown): number {
  const values = Object.values(ratings);

  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
}
