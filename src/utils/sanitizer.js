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

  // 1. Remove control characters (except newline and tab if we want to keep them, 
  // but usually we want to strip most of them)
  // eslint-disable-next-line no-control-regex
  let sanitized = text.replace(/[\x00-\x1F\x7F]/g, '');

  // 2. Strip HTML tags
  sanitized = sanitized.replace(/<[^>]*>?/gm, '');

  // 3. Neutralize common prompt injection patterns
  const injectionPatterns = [
    /ignore previous instructions/gi,
    /stop following instructions/gi,
    /follow these new instructions/gi,
    /system prompt/gi,
    /you are now/gi
  ];

  let hasInjection = false;
  for (const pattern of injectionPatterns) {
    if (pattern.test(sanitized)) {
      sanitized = sanitized.replace(pattern, (match) => `[REDACTED: ${match}]`);
      hasInjection = true;
    }
  }

  if (hasInjection) {
    sanitized += ' [POTENTIAL INJECTION]';
  }

  // 4. Trim excessive whitespace
  sanitized = sanitized.replace(/\s+/g, ' ').trim();

  return sanitized;
}
