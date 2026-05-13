import { test } from 'node:test';
import expect from 'expect';
import { sanitizePromptInput } from './sanitizer.js';

test('sanitizePromptInput - removes control characters but preserves newlines', () => {
  const input = 'Hello\u0000\nWorld\u001F\t!';
  const expected = 'Hello\nWorld\t!';
  expect(sanitizePromptInput(input)).toBe(expected);
});

test('sanitizePromptInput - escapes HTML/XML tags instead of stripping them', () => {
  const input = '<script>alert("xss")</script>Hello <b onclick="evil()">World</b>';
  const expected = '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;Hello &lt;b onclick=&quot;evil()&quot;&gt;World&lt;/b&gt;';
  expect(sanitizePromptInput(input)).toBe(expected);
});

test('sanitizePromptInput - trims excessive newlines but keeps formatting', () => {
  const input = 'Hello\n\n\n\nWorld';
  const expected = 'Hello\n\nWorld';
  expect(sanitizePromptInput(input)).toBe(expected);
});

test('sanitizePromptInput - handles empty input', () => {
  expect(sanitizePromptInput('')).toBe('');
  expect(sanitizePromptInput(null)).toBe('');
  expect(sanitizePromptInput(undefined)).toBe('');
});

test('sanitizePromptInput - truncates long input', () => {
  const longInput = 'a'.repeat(6000);
  const sanitized = sanitizePromptInput(longInput);
  expect(sanitized.length).toBeLessThanOrEqual(5000);
});
