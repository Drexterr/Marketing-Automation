import { spawn } from 'child_process';
import { tmpdir } from 'os';
import { dirname } from 'path';
import logger from './logger.js';

// Calls the Claude CLI with a single combined prompt.
// Requires `claude` to be installed and logged in: npm install -g @anthropic-ai/claude-code
export async function callCLI(prompt, retries = 2) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await _spawn(prompt);
    } catch (error) {
      if (attempt === retries) throw error;
      logger.warn(`Claude CLI retry ${attempt}`, { message: error.message });
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

function _spawn(prompt) {
  return new Promise((resolve, reject) => {
    // On Windows, npm global binaries are .cmd files and cannot be spawned
    // with shell:false. We use shell:true only on Windows; on POSIX the binary
    // is a real executable so shell:false is fine (and safer).
    const isWindows = process.platform === 'win32';
    const command = 'claude';

    // Pass the prompt via stdin rather than as a positional argument.
    // On Windows, shell:true concatenates args into a cmd.exe command string,
    // which causes special characters like ( ) & | in the prompt to be
    // misinterpreted as shell syntax, truncating the prompt mid-string.
    // Piping through stdin bypasses shell argument parsing entirely.
    // Run from tmp dir so Claude CLI doesn't load this project's CLAUDE.md/memory
    const proc = spawn(command, ['--output-format', 'text', '-p'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: isWindows,
      cwd: tmpdir(),
      timeout: 90000
    });

    proc.stdin.write(prompt, 'utf8');
    proc.stdin.end();

    let output = '';
    let errorOutput = '';

    proc.stdout.on('data', d => { output += d.toString(); });
    proc.stderr.on('data', d => { errorOutput += d.toString(); });

    proc.on('close', code => {
      const text = output.trim();
      if (code === 0 && text) {
        resolve(text);
      } else {
        reject(new Error(
          `Claude CLI exited ${code}. ${errorOutput.slice(0, 300) || 'No output received.'}`
        ));
      }
    });

    proc.on('error', err => {
      if (err.code === 'ENOENT') {
        reject(new Error(
          'Claude CLI not found in PATH.\n' +
          'Install it: npm install -g @anthropic-ai/claude-code\n' +
          'Then log in: claude login'
        ));
      } else {
        reject(err);
      }
    });
  });
}

/**
 * Call the Claude CLI with an image file attached.
 * The CLI reads the file via its built-in Read tool (--add-dir grants access).
 * imagePath must be an absolute path to an existing PNG/JPEG file.
 */
export async function callCLIWithImage(prompt, imagePath, retries = 2) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await _spawnWithImage(prompt, imagePath);
    } catch (error) {
      if (attempt === retries) throw error;
      logger.warn(`Claude CLI (image) retry ${attempt}`, { message: error.message });
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

function _spawnWithImage(prompt, imagePath) {
  return new Promise((resolve, reject) => {
    const isWindows = process.platform === 'win32';
    const imgDir = dirname(imagePath);

    const proc = spawn('claude', ['--output-format', 'text', '-p', '--add-dir', imgDir], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: isWindows,
      cwd: tmpdir(),
      timeout: 120000,
    });

    // Embed the file path at the top of the prompt so the CLI reads it first
    const fullPrompt = `Read the image file at: ${imagePath}\n\n${prompt}`;
    proc.stdin.write(fullPrompt, 'utf8');
    proc.stdin.end();

    let output = '';
    let errorOutput = '';
    proc.stdout.on('data', d => { output += d.toString(); });
    proc.stderr.on('data', d => { errorOutput += d.toString(); });

    proc.on('close', code => {
      const text = output.trim();
      if (code === 0 && text) {
        resolve(text);
      } else {
        reject(new Error(
          `Claude CLI (image) exited ${code}. ${errorOutput.slice(0, 300) || 'No output.'}`
        ));
      }
    });

    proc.on('error', err => reject(err));
  });
}

export async function testCLI() {
  return callCLI('Reply with exactly the words: connection successful');
}
