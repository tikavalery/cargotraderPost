/** No-op stand-in for mongoose sessions (PostgreSQL shim runs sequentially). */
export function createNoopSession() {
  return {
    startTransaction() {},
    async commitTransaction() {},
    async abortTransaction() {},
    async endSession() {}
  };
}

export default createNoopSession;
