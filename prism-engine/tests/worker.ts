/**
 * Minimal test worker for unit tests that only need D1/R2 bindings.
 * Avoids loading the full src/index.ts which pulls in supertokens-node
 * (incompatible with Vitest Workers runtime).
 */
export default {
  async fetch() {
    return new Response('test-worker');
  },
};
