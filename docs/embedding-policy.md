# Code chunking and Voyage embeddings

The default embedding provider is Voyage AI with voyage-code-4 and 1024 output dimensions. Answer generation is configured independently. Groq handles answer generation through the Groq API.

| Setting | Policy |
|---|---|
| Preferred boundary | Function or method with its signature |
| Target size | 500 to 1000 locally estimated tokens |
| Hard ceiling | 1500 locally estimated tokens, including embedding context |
| Small symbols | Keep intact; do not pad or merge unrelated functions |
| Split symbols | Prefer complete AST statement boundaries |
| Overlap | 50 to 100 tokens only across split oversized symbols |
| File and documentation chunks | No artificial overlap |
| Long lines | Bounded character fallback preserving all source spans |
| Context | Bounded path, scope, signature and imports |
| Stored vectors | 1024 dimensions per chunk |
| Indexing task | Voyage input_type=document |
| Search task | Same model and dimensions with input_type=query |
| Truncation | Disabled; reject over-limit inputs instead of truncating silently |

The target is a range rather than a minimum requirement. A 100-token function remains one chunk, and a complete 1200-token function can remain intact under the ceiling. Large symbols split into approximately target-sized fragments. The local cl100k tokenizer provides consistent policy estimates, not exact Voyage billing counts; live evaluation is still required.

Original code text and source line numbers are preserved separately from embedding context. Hashes cover the contextual embedding input, so changing an import or signature invalidates the relevant embedding cache entries. Snapshot identity includes the embedding and chunk-policy generation.

Neo4j uses a deterministic generation label and vector-index name. Previously stored embedding generations remain separate and are not queried by the active generation. Only matching-generation READY snapshots can be queried with the active embedding provider. Refresh a repository after switching providers, even if its commit is unchanged. Do not manually edit the old index dimensions or reuse old embeddings with the new query model.

The adapter validates batch count, unique response indexes, finite numeric values, nonzero vectors, and the exact output dimension. Requests have bounded batches, response byte limits, deadlines, and safe errors. Provider response bodies and secret values are not logged. Voyage credentials are required only for embedding work; answer credentials are checked separately by their adapter and readiness checks.

Local verification covers source coverage, logical chunk boundaries, overlap, long lines, context, vector response validation, task types, and provider error handling. A live Neo4j probe passed with 1024-dimensional synthetic vectors and cleaned up its temporary data. It does not establish Voyage semantic quality or account eligibility. The live connection check passed with a real Voyage request returning 1024 dimensions; repository retrieval quality remains to be evaluated.

Official API references consulted on 3 November 2026:

- https://docs.voyageai.com/docs/embeddings
- https://docs.voyageai.com/reference/embeddings-api
