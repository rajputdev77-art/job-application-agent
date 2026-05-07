// Local application log + safety controls.
// Reads/writes a JSON file at ../setup/applied_jobs.json
// Used to:
//  - Skip already-applied jobs (dedupe)
//  - Enforce daily rate limit (don't blast LinkedIn)
//  - Track all submissions for the dashboard

const fs = require('fs');
const path = require('path');

const LOG_PATH = path.join(__dirname, '..', 'setup', 'applied_jobs.json');
const DAILY_LIMIT = 30;  // safety cap per platform per day

function load() {
  if (!fs.existsSync(LOG_PATH)) return { applications: [] };
  try {
    return JSON.parse(fs.readFileSync(LOG_PATH, 'utf-8'));
  } catch (_) {
    return { applications: [] };
  }
}

function save(data) {
  if (!fs.existsSync(path.dirname(LOG_PATH))) {
    fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  }
  fs.writeFileSync(LOG_PATH, JSON.stringify(data, null, 2));
}

function alreadyApplied(jobUrl) {
  const data = load();
  return data.applications.some(a => a.job_url === jobUrl && a.status === 'APPLIED');
}

function appliedTodayCount(platform) {
  const data = load();
  const today = new Date().toISOString().slice(0, 10);
  return data.applications.filter(a =>
    a.timestamp.startsWith(today) && a.platform === platform
  ).length;
}

function canApply(jobUrl, platform) {
  if (alreadyApplied(jobUrl)) {
    return { ok: false, reason: 'Already applied to this job' };
  }
  const todayCount = appliedTodayCount(platform);
  if (todayCount >= DAILY_LIMIT) {
    return { ok: false, reason: `Daily limit ${DAILY_LIMIT} reached for ${platform}` };
  }
  return { ok: true };
}

function recordApplication(record) {
  const data = load();
  data.applications.push({
    timestamp: new Date().toISOString(),
    ...record
  });
  // Cap log at 5000 entries
  if (data.applications.length > 5000) {
    data.applications = data.applications.slice(-5000);
  }
  save(data);
}

module.exports = { load, save, alreadyApplied, appliedTodayCount, canApply, recordApplication };

// CLI usage: node application_log.js [stats|list|clear]
if (require.main === module) {
  const cmd = process.argv[2] || 'stats';
  const data = load();

  if (cmd === 'stats') {
    const today = new Date().toISOString().slice(0, 10);
    const todayApps = data.applications.filter(a => a.timestamp.startsWith(today));
    console.log(`Total applications logged: ${data.applications.length}`);
    console.log(`Applied today (${today}): ${todayApps.length}`);
    const byPlatform = {};
    for (const a of data.applications) {
      byPlatform[a.platform] = (byPlatform[a.platform] || 0) + 1;
    }
    console.log('By platform:', byPlatform);
  } else if (cmd === 'list') {
    for (const a of data.applications.slice(-20)) {
      console.log(`[${a.timestamp}] ${a.status} ${a.platform} | ${a.company} - ${a.job_title}`);
    }
  } else if (cmd === 'clear') {
    save({ applications: [] });
    console.log('Cleared.');
  }
}
