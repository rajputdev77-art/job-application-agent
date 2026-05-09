// Job Agent Helper Service
// 1. POST /run-command       - run a whitelisted Playwright command
// 2. POST /tier1-queue       - add a Tier 1 job to the pending review queue
// 3. GET  /tier1-pending     - list pending Tier 1 reviews (used by dashboard)
// 4. POST /tier1-submit/:id  - open browser to fill that Tier 1 form (user clicks Submit)
// 5. POST /tier1-skip/:id    - mark a pending Tier 1 as skipped/done

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const url = require('url');

const PORT = 9999;
const BASE = path.join(__dirname, '..');
const LOGFILE = path.join(BASE, 'setup', 'logs', 'helper.log');
const TIER1_QUEUE = path.join(BASE, 'setup', 'tier1_pending.json');

if (!fs.existsSync(path.dirname(LOGFILE))) fs.mkdirSync(path.dirname(LOGFILE), { recursive: true });

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(LOGFILE, line);
  process.stdout.write(line);
}

function loadQueue() {
  if (!fs.existsSync(TIER1_QUEUE)) return { pending: [] };
  try { return JSON.parse(fs.readFileSync(TIER1_QUEUE, 'utf-8')); }
  catch { return { pending: [] }; }
}

function saveQueue(data) {
  fs.writeFileSync(TIER1_QUEUE, JSON.stringify(data, null, 2));
}

function runCommand(command, opts = {}) {
  return new Promise((resolve) => {
    log(`RUN: ${command}`);
    const proc = spawn('cmd.exe', ['/c', command], {
      cwd: BASE,
      env: { ...process.env },
      windowsHide: !opts.visible,
      detached: !!opts.detached,
      timeout: opts.timeout || 600000
    });
    if (opts.detached) {
      proc.unref();
      return resolve({ success: true, detached: true, pid: proc.pid });
    }
    let stdout = '', stderr = '';
    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.on('close', code => {
      let parsedOutput = null;
      try {
        const m = stdout.match(/\{[\s\S]*\}/);
        if (m) parsedOutput = JSON.parse(m[0]);
      } catch (_) {}
      resolve({ success: code === 0, stdout: stdout.substring(0, 50000), stderr: stderr.substring(0, 10000), exitCode: code, parsedOutput });
    });
    proc.on('error', err => resolve({ success: false, stdout: '', stderr: err.message, exitCode: -1, parsedOutput: null }));
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', c => { body += c.toString(); });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (e) { reject(e); }
    });
  });
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.end(JSON.stringify(payload));
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const route = parsed.pathname;

  if (req.method === 'OPTIONS') return sendJson(res, 204, {});

  if (req.method === 'GET' && route === '/health') {
    return sendJson(res, 200, { status: 'ok', service: 'job-agent-helper', port: PORT });
  }

  // === Tier 1 queue endpoints ===

  if (req.method === 'POST' && route === '/tier1-queue') {
    try {
      const body = await readBody(req);
      const queue = loadQueue();
      const id = `t1-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      queue.pending.push({
        id,
        queuedAt: new Date().toISOString(),
        company: body.company,
        job_title: body.job_title,
        location: body.location,
        job_url: body.job_url,
        score: body.score,
        tailoredCvPath: body.tailoredCvPath,
        coverLetterPath: body.coverLetterPath,
        status: 'PENDING'
      });
      saveQueue(queue);
      log(`Tier 1 queued: ${body.company} - ${body.job_title}`);
      return sendJson(res, 200, { id, message: 'Queued for manual review' });
    } catch (e) {
      return sendJson(res, 400, { error: e.message });
    }
  }

  if (req.method === 'GET' && route === '/tier1-pending') {
    const queue = loadQueue();
    return sendJson(res, 200, queue);
  }

  if (req.method === 'POST' && route.startsWith('/tier1-submit/')) {
    const id = route.split('/').pop();
    const queue = loadQueue();
    const item = queue.pending.find(p => p.id === id);
    if (!item) return sendJson(res, 404, { error: 'Not found' });
    if (item.status !== 'PENDING') return sendJson(res, 400, { error: `Already ${item.status}` });

    // Open browser visibly to fill the form (NOT detached — script keeps running until user closes)
    const cmd = `node playwright/tier1_form_fill.js --url "${item.job_url}" --cv "${item.tailoredCvPath || ''}" --coverletter "${item.coverLetterPath || ''}" --company "${item.company}" --title "${item.job_title}"`;
    log(`Opening Tier 1 form for: ${item.company}`);

    // Mark as opened immediately
    item.status = 'OPENED';
    item.openedAt = new Date().toISOString();
    saveQueue(queue);

    // Launch in background so HTTP response is fast
    runCommand(cmd, { visible: true, timeout: 1800000, detached: true });

    return sendJson(res, 200, { message: 'Browser launching — fill out and click Submit when ready', id });
  }

  if (req.method === 'POST' && route.startsWith('/tier1-skip/')) {
    const id = route.split('/').pop();
    const queue = loadQueue();
    const item = queue.pending.find(p => p.id === id);
    if (!item) return sendJson(res, 404, { error: 'Not found' });
    item.status = 'SKIPPED';
    item.skippedAt = new Date().toISOString();
    saveQueue(queue);
    return sendJson(res, 200, { message: 'Marked as skipped' });
  }

  if (req.method === 'POST' && route.startsWith('/tier1-done/')) {
    const id = route.split('/').pop();
    const queue = loadQueue();
    const item = queue.pending.find(p => p.id === id);
    if (!item) return sendJson(res, 404, { error: 'Not found' });
    item.status = 'SUBMITTED';
    item.submittedAt = new Date().toISOString();
    saveQueue(queue);
    return sendJson(res, 200, { message: 'Marked as submitted' });
  }

  // === Generic command runner ===

  if (req.method === 'POST' && route === '/run-command') {
    let body;
    try { body = await readBody(req); } catch (e) {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const command = body.command;
    if (!command) return sendJson(res, 400, { error: 'Missing command' });
    if (!/^(node\s+playwright[\\/]|echo\s|dir\s|node\s+-v$)/.test(command.trim())) {
      log(`REJECTED: ${command}`);
      return sendJson(res, 403, { error: 'Command not allowed' });
    }
    const result = await runCommand(command);
    return sendJson(res, 200, result);
  }

  // === Scraper endpoints (run Playwright scrapers, return parsed JSON) ===
  if (req.method === 'POST' && route.startsWith('/scrape/')) {
    const platform = route.split('/').pop();
    const allowed = ['naukri', 'indeed', 'wttj', 'tier1'];
    if (!allowed.includes(platform)) return sendJson(res, 400, { error: 'Unknown platform' });
    const cmd = `node playwright/scrape_${platform}.js`;
    const result = await runCommand(cmd, { timeout: 600000 });
    if (result.parsedOutput && result.parsedOutput.jobs) {
      return sendJson(res, 200, result.parsedOutput);
    }
    return sendJson(res, 200, { jobs: [], error: result.stderr || 'No output' });
  }

  return sendJson(res, 404, { error: 'Not found', method: req.method, path: route });
});

server.listen(PORT, '127.0.0.1', () => {
  log(`Helper service listening on http://127.0.0.1:${PORT}`);
});

process.on('uncaughtException', err => log(`UNCAUGHT: ${err.message}\n${err.stack}`));
