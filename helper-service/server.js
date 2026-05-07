// Playwright/Command Helper Service
// Receives command requests from n8n executor agents and runs them locally.
// Endpoint: POST http://127.0.0.1:9999/run-command
// Body: { "command": "node playwright/linkedin_apply.js --url X --cv Y" }
// Returns: { success: bool, stdout: string, stderr: string, exitCode: int, parsedOutput: object|null }

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = 9999;
const BASE = path.join(__dirname, '..');
const LOGFILE = path.join(BASE, 'setup', 'logs', 'helper.log');

if (!fs.existsSync(path.dirname(LOGFILE))) {
  fs.mkdirSync(path.dirname(LOGFILE), { recursive: true });
}

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(LOGFILE, line);
  process.stdout.write(line);
}

function runCommand(command) {
  return new Promise((resolve) => {
    log(`RUN: ${command}`);

    const proc = spawn('cmd.exe', ['/c', command], {
      cwd: BASE,
      env: { ...process.env },
      windowsHide: true,
      timeout: 600000  // 10 min
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      log(`EXIT ${code}: stdout=${stdout.length}b stderr=${stderr.length}b`);

      // Try to parse JSON from stdout (Playwright scripts return JSON)
      let parsedOutput = null;
      try {
        const jsonMatch = stdout.match(/\{[\s\S]*\}/);
        if (jsonMatch) parsedOutput = JSON.parse(jsonMatch[0]);
      } catch (_) {}

      resolve({
        success: code === 0,
        stdout: stdout.substring(0, 50000),
        stderr: stderr.substring(0, 10000),
        exitCode: code,
        parsedOutput
      });
    });

    proc.on('error', (err) => {
      log(`ERROR spawning: ${err.message}`);
      resolve({ success: false, stdout: '', stderr: err.message, exitCode: -1, parsedOutput: null });
    });
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'GET' && req.url === '/health') {
    return res.end(JSON.stringify({ status: 'ok', service: 'job-agent-helper', port: PORT }));
  }

  if (req.method !== 'POST' || req.url !== '/run-command') {
    res.statusCode = 404;
    return res.end(JSON.stringify({ error: 'POST /run-command only' }));
  }

  let body = '';
  req.on('data', (chunk) => { body += chunk.toString(); });
  req.on('end', async () => {
    let parsed;
    try {
      parsed = JSON.parse(body || '{}');
    } catch (e) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: 'Invalid JSON', detail: e.message }));
    }

    const command = parsed.command;
    if (!command) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: 'Missing command' }));
    }

    // Security: only allow commands that start with "node playwright/" or test commands
    if (!/^(node\s+playwright[\\/]|echo\s|dir\s|node\s+-v$)/.test(command.trim())) {
      log(`REJECTED: ${command}`);
      res.statusCode = 403;
      return res.end(JSON.stringify({ error: 'Command not allowed', command }));
    }

    const result = await runCommand(command);
    res.end(JSON.stringify(result));
  });
});

server.listen(PORT, '127.0.0.1', () => {
  log(`Helper service listening on http://127.0.0.1:${PORT}`);
});

process.on('uncaughtException', (err) => {
  log(`UNCAUGHT: ${err.message}\n${err.stack}`);
});
