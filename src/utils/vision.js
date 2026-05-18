/**
 * Vision utilities — screenshot the Playwright page and send to Claude CLI
 * for visual analysis. No ANTHROPIC_API_KEY required; uses the logged-in
 * `claude` binary via callCLIWithImage().
 */

import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import logger from './logger.js';
import { callCLIWithImage, callCLI } from './claude-cli.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Take a viewport screenshot and save it to a temp file. Returns the path. */
async function saveScreenshot(page) {
  const buf = await page.screenshot({ type: 'png' });
  const path = join(tmpdir(), `li_vision_${Date.now()}.png`);
  writeFileSync(path, buf);
  return path;
}

function cleanupFile(path) {
  try { unlinkSync(path); } catch { /* ignore */ }
}

function parseJSON(text) {
  return JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Find a UI element by description using a screenshot + Claude CLI.
 * Returns true if found and clicked, false otherwise.
 *
 * Strategy:
 *  1. Try Playwright's getByRole() built-ins (free, instant).
 *  2. Take a screenshot, ask Claude CLI where the element is (pixel coords).
 *  3. Click at the returned coordinates.
 */
export async function visionClick(page, description) {
  const lower = description.toLowerCase();

  // 1. Fast-path: role-based locators that don't need a screenshot
  const roleMap = [
    [/connect/,       () => page.getByRole('button', { name: /connect/i }).first()],
    [/add a note/,    () => page.getByRole('button', { name: /add a note/i }).first()],
    [/send now|^send/,() => page.getByRole('button', { name: /send now|^send$/i }).first()],
    [/^message$/,     () => page.getByRole('button', { name: /^message$/i }).first()],
    [/^comment$/,     () => page.getByRole('button', { name: /^comment$/i }).first()],
    [/^post$/,        () => page.getByRole('button', { name: /^post$/i }).first()],
    [/start a post/,  () => page.getByRole('button', { name: /start a post/i }).first()],
    [/close|dismiss/, () => page.getByRole('button', { name: /close|dismiss/i }).first()],
    [/more actions/,  () => page.getByRole('button', { name: /more actions/i }).first()],
  ];

  for (const [pattern, getLocator] of roleMap) {
    if (!pattern.test(lower)) continue;
    try {
      const loc = getLocator();
      if (await loc.isVisible({ timeout: 2000 })) {
        await loc.click();
        logger.info(`visionClick: "${description}" — matched via getByRole`);
        return true;
      }
    } catch { /* try next */ }
  }

  // 2. Screenshot → Claude CLI
  logger.info(`visionClick: taking screenshot for "${description}"`);
  const imgPath = await saveScreenshot(page);
  const dpr = await page.evaluate(() => window.devicePixelRatio || 1);

  try {
    const result = await callCLIWithImage(
      `Find this element in the screenshot: ${description}
Return ONLY JSON with the center pixel coordinates: {"x": <number>, "y": <number>}
If not visible, return: {}`,
      imgPath
    );

    let data;
    try { data = parseJSON(result); } catch {
      // CLI returned plain English ("I'm unable to...") — element not found
      logger.warn(`visionClick: "${description}" — CLI returned non-JSON: "${result.slice(0, 80)}"`);
      return false;
    }
    if (!data.x || !data.y) {
      logger.warn(`visionClick: "${description}" not found in screenshot`);
      return false;
    }

    const x = Math.round(data.x / dpr);
    const y = Math.round(data.y / dpr);
    logger.info(`visionClick: "${description}" → (${x}, ${y})`);
    await page.mouse.click(x, y);
    return true;
  } catch (e) {
    logger.warn(`visionClick: failed for "${description}"`, { error: e.message });
    return false;
  } finally {
    cleanupFile(imgPath);
  }
}

/**
 * Find the active text editor (comment box, message box, post editor).
 * Tries stable ARIA selectors first, then screenshot + Claude CLI.
 * Returns a Playwright ElementHandle or null.
 */
export async function visionFindEditor(page, waitMs = 5000) {
  const SELECTORS = [
    '[role="textbox"][contenteditable="true"]',
    '.ql-editor[contenteditable="true"]',
    'div.msg-form__contenteditable',
    'textarea[name="message"]',
    'textarea:not([aria-hidden="true"])',
    '[contenteditable="true"]',
  ];

  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    for (const sel of SELECTORS) {
      const el = await page.$(sel);
      if (el && await el.isVisible().catch(() => false)) {
        logger.info(`visionFindEditor: found via "${sel}"`);
        return el;
      }
    }
    try {
      const loc = page.getByRole('textbox').first();
      if (await loc.isVisible({ timeout: 300 })) {
        logger.info('visionFindEditor: found via getByRole(textbox)');
        return loc.elementHandle();
      }
    } catch { /* keep polling */ }
    await new Promise(r => setTimeout(r, 400));
  }

  // Screenshot fallback
  logger.info('visionFindEditor: ARIA selectors missed — using screenshot');
  const imgPath = await saveScreenshot(page);
  const dpr = await page.evaluate(() => window.devicePixelRatio || 1);

  try {
    const result = await callCLIWithImage(
      `Find the text input area (comment box, message editor, or post editor) in the screenshot.
Return ONLY JSON: {"x": <pixel_x>, "y": <pixel_y>}
If not visible: {}`,
      imgPath
    );

    const data = parseJSON(result);
    if (!data.x || !data.y) return null;

    const x = Math.round(data.x / dpr);
    const y = Math.round(data.y / dpr);
    logger.info(`visionFindEditor: found via screenshot at (${x}, ${y})`);
    await page.mouse.click(x, y);
    await new Promise(r => setTimeout(r, 300));
    return page.evaluateHandle(() => document.activeElement);
  } catch (e) {
    logger.warn('visionFindEditor: screenshot fallback failed', { error: e.message });
    return null;
  } finally {
    cleanupFile(imgPath);
  }
}

/**
 * General-purpose screenshot analysis via Claude CLI.
 * prompt should end with "Return ONLY valid JSON: ..."
 * Returns { data, error }.
 */
export async function visionQuery(page, prompt) {
  const imgPath = await saveScreenshot(page);
  try {
    const result = await callCLIWithImage(prompt, imgPath);
    const data = parseJSON(result);
    return { data, error: null };
  } catch (e) {
    logger.warn('visionQuery: failed', { error: e.message });
    return { data: null, error: e.message };
  } finally {
    cleanupFile(imgPath);
  }
}
