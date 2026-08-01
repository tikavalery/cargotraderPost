/** True for cuid, uuid, or legacy 24-hex Mongo ObjectId strings. */
export function isValidId(id) {
  if (id == null) return false;
  const s = String(id);
  if (!s || s === 'undefined' || s === 'null') return false;
  return (
    /^c[a-z0-9]{24,}$/i.test(s) ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s) ||
    /^[a-f0-9]{24}$/i.test(s)
  );
}

export default isValidId;
