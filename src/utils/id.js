// ─────────────────────────────────────────────
// ID Generator Utilities
// Counter-based IDs stored in db.json settings
// ─────────────────────────────────────────────

const collectionMap = {
  PRD: 'products',
  CAT: 'categories',
  USR: 'users',
  ORD: 'orders',
  TKT: 'tickets',
  MSG: 'messages',
  DON: 'donations',
};

// Custom display prefix, separator, zero-padding, and startFrom per prefix key
const prefixOverride = {
  ORD: { display: 'TLEORDER', sep: '_', pad: 5, startFrom: 1 },
};

/**
 * Generate next ID for a given prefix
 * Uses counters stored in db settings
 * @param {object} db - database object (will be mutated)
 * @param {string} prefix - e.g. "USR", "PRD", "ORD", "TKT", "MSG", "CAT"
 * @param {number} [startFrom] - default starting counter value (overridden by prefixOverride)
 * @returns {string} e.g. "TLEORDER_00001", "USR-10001"
 */
function generateId(db, prefix, startFrom = 10001) {
  if (!db.settings) db.settings = {};
  if (!db.settings.counters) db.settings.counters = {};

  const override = prefixOverride[prefix];
  const counterKey = `${prefix.toLowerCase()}Counter`;
  const effectiveStart = override && override.startFrom !== undefined ? override.startFrom : startFrom;

  let currentVal = db.settings.counters[counterKey] || effectiveStart;

  const displayPrefix = override ? override.display : prefix;
  const sep = override ? override.sep : '-';
  const pad = (override && override.pad) ? override.pad : 0;

  const makeId = (val) => `${displayPrefix}${sep}${pad ? String(val).padStart(pad, '0') : val}`;

  const collectionName = collectionMap[prefix];
  if (collectionName && Array.isArray(db[collectionName])) {
    const existingIds = new Set(db[collectionName].map((item) => item.id).filter(Boolean));
    while (existingIds.has(makeId(currentVal))) {
      currentVal++;
    }
  }

  const id = makeId(currentVal);
  db.settings.counters[counterKey] = currentVal + 1;

  return id;
}

/**
 * Generate support ticket ID
 * @param {object} db
 * @returns {string} e.g. "TKT-SUP-10001"
 */
function generateSupportTicketId(db) {
  if (!db.settings) db.settings = {};
  if (!db.settings.counters) db.settings.counters = {};

  const counterKey = 'tktSupCounter';
  if (!db.settings.counters[counterKey]) {
    db.settings.counters[counterKey] = 10001;
  }

  const id = `TKT-SUP-${db.settings.counters[counterKey]}`;
  db.settings.counters[counterKey]++;

  return id;
}

module.exports = { generateId, generateSupportTicketId };
