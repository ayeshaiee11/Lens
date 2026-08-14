let counter = 1;

/**
 * Generates the same style of id the frontend already uses
 * (e.g. "inv_lz3f9a_1"), so records created here slot in
 * seamlessly with anything the client generated optimistically.
 */
function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${(counter++).toString(36)}`;
}

module.exports = { uid };
