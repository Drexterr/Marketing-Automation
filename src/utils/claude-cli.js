import { spawn } from 'child_process';
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
    // shell:false is used for security to harden against command injection.
    // On Windows, 'claude' resolves to 'claude.exe' in the user's local bin, 
    // so it works without shell:true.
    const command = 'claude';
    
    const proc = spawn(command, ['--output-format', 'text', '-p', prompt], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      timeout: 90000
    });

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

export async function testCLI() {
  return callCLI('Reply with exactly the words: connection successful');
}
