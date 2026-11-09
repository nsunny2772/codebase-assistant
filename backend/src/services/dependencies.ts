import type { Config } from "../config/index.js";
import { commonStrings } from "../constants/common.js";
import type { Store } from "../repositories/store.js";
import { AppError } from "../utils/app-error.js";
import type { AI } from "./ai.js";

export interface ServiceDependencies {
  config: Config;
  store?: Store;
  ai?: AI;
}

export const requireStore = (dependencies: ServiceDependencies): Store => {
  if (!dependencies.store)
    throw new AppError(
      "SERVICE_NOT_CONFIGURED",
      commonStrings.SERVICE_NOT_CONFIGURED,
      503,
    );
  return dependencies.store;
};

export const requireAI = (dependencies: ServiceDependencies): AI => {
  if (!dependencies.ai)
    throw new AppError(
      "SERVICE_NOT_CONFIGURED",
      commonStrings.SERVICE_NOT_CONFIGURED,
      503,
    );
  return dependencies.ai;
};
