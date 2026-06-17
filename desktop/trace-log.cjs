const MAX = 80;

function createTraceLog() {
  /** @type {Array<{at:number, event:string, from?:string, to?:string, detail?:string}>} */
  const entries = [];

  function push(entry) {
    entries.unshift({ at: Date.now(), ...entry });
    if (entries.length > MAX) {
      entries.length = MAX;
    }
  }

  function list(limit = 50) {
    return entries.slice(0, limit);
  }

  return { push, list };
}

module.exports = {
  createTraceLog,
};
