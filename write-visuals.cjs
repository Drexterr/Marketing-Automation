const fs = require('fs');
const path = require('path');

const targetDir = 'C:\\Users\\bharat.jain\\.gemini\\tmp\\auto\\brainstorm\\content';
fs.mkdirSync(targetDir, { recursive: true });

const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Superpowers Brainstorming</title>
  <style>
    body { font-family: sans-serif; padding: 2rem; background: #f5f5f7; color: #1d1d1f; line-height: 1.5; }
    .card { background: white; border: 1px solid #d1d1d6; border-radius: 12px; padding: 1.5rem; margin-bottom: 1rem; cursor: pointer; transition: border-color 0.2s; }
    .card:hover { border-color: #0071e3; }
    h1 { font-size: 1.5rem; margin-bottom: 1.5rem; }
    h2 { font-size: 1.1rem; margin-bottom: 0.5rem; font-weight: 600; }
    p { color: #86868b; font-size: 0.9rem; margin: 0; }
    .container { max-width: 600px; margin: 0 auto; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Phase B: Operational Dashboard</h1>
    <div class="card">
      <h2>1. The Supervisor (Control-First)</h2>
      <p>Focuses on immediate visibility of the scheduler and manual overrides. Large indicators for Active Task and Next Run. Big Emergency Stop button.</p>
    </div>
    <div class="card">
      <h2>2. The Closer (Inbox-First)</h2>
      <p>Prioritizes human-in-the-loop. Quick-action view for AI-drafted replies and lead escalations. One-click Approve & Send.</p>
    </div>
    <div class="card">
      <h2>3. The Strategist (Prompt-First)</h2>
      <p>Focuses on optimization. Frequent tweaks to AI prompts and target audience keywords. Visualized performance analytics.</p>
    </div>
  </div>
</body>
</html>
`;

fs.writeFileSync(path.join(targetDir, 'index.html'), html);
console.log('Successfully wrote index.html');
