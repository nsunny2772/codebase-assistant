export const isNearLimit = (used?: number, limit?: number) =>
  Boolean(limit && limit > 0 && used !== undefined && used / limit > 0.8);
