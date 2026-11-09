import type { Config } from "../config/index.js";
import type { AI } from "./ai.js";
import { GroqService } from "./groq.js";
import { VoyageEmbeddings } from "./voyage.js";
export function createAI(config: Config): AI {
  const embeddings = new VoyageEmbeddings(config);

  const answers = new GroqService(config);
  return {
    embed: (texts, signal, purpose) => embeddings.embed(texts, signal, purpose),
    generate: (...args) => answers.generate(...args),
  };
}
