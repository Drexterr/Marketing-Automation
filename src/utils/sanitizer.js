/**
 * Sanitizes input text to be used in LLM prompts.
 * 
 * @param {string} text - The input text to sanitize.
 * @returns {string} - The sanitized text.
 */
export function sanitizePromptInput(text) {
  if (text === null || text === undefined) {
    return '';
  }

  if (typeof text !== 'string') {
    text = String(text);
  }

  // 1. Remove dangerous control characters but preserve newlines (\n, \r) and tabs (\t)
  // \x00-\x08, \x0B-\x0C, \x0E-\x1F, \x7F
  // eslint-disable-next-line no-control-regex
  let sanitized = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // 2. Escape XML-like tags to prevent breakout from our XML delimiters
  // Instead of stripping them completely which destroys code examples,
  // we escape <, >, &, ", and ' to entities
  sanitized = sanitized.replace(/&/g, '&amp;')
                       .replace(/</g, '&lt;')
                       .replace(/>/g, '&gt;')
                       .replace(/"/g, '&quot;')
                       .replace(/'/g, '&#39;');

  // 3. Trim excessive whitespace but preserve single newlines
  // Replace 3 or more newlines with exactly 2 newlines
  sanitized = sanitized.replace(/\n{3,}/g, '\n\n');

  // 4. Truncate to safe length
  if (sanitized.length > 5000) {
    sanitized = sanitized.slice(0, 5000);
  }

  return sanitized.trim();
}
