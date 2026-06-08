// Shared pre-filter: returns true if a job is worth scoring, false to skip.
// Drops obvious junk that doesn't match Dev's criteria so we don't waste Llama time.

// Reject if title contains these (case-insensitive)
const REJECT_TITLE_PATTERNS = [
  /\bhr\b/i, /human\s*resource/i, /recruit/i, /talent\s*acquisition/i,
  /sales\s*executive/i, /telesales/i, /cold\s*call/i, /channel\s*partner/i,
  /relationship\s*manager/i, /real\s*estate\s*sales/i, /broker/i,
  /data\s*entry/i, /back\s*office/i, /walk[- ]?in/i,
  /software\s*engineer/i, /\b(senior|sr|jr|junior)?\s*developer\b/i,
  /full\s*stack/i, /backend\s*engineer/i, /frontend\s*engineer/i,
  /data\s*scientist/i, /machine\s*learning\s*engineer/i, /\bml\s*engineer/i,
  /research\s*engineer/i, /devops/i, /sre/i, /qa\s*engineer/i,
  /accountant/i, /audit/i, /tax\b/i, /finance\s*manager/i,
  /interior/i, /architect\b/i, /civil/i, /mechanical/i, /electrical\s*engineer/i,
  /welder/i, /production\s*manager/i, /manufacturing/i,
  /nurse/i, /doctor/i, /clinical/i, /pharm/i,
  /chef/i, /driver/i, /security\s*guard/i, /cleaner/i, /housekeeping/i,
  /teach/i, /coaching/i, /trainer\b/i,
  /intern\b/i, /trainee/i, /fresher/i, /walk in/i,
];

// Reject if company name matches these (case-insensitive)
const REJECT_COMPANY_PATTERNS = [
  /coaching/i, /tuition/i, /institute/i, /academy/i,
  /weldedmesh/i, /solar/i, /steel\b/i, /pharma/i, /hospital/i,
  /interior/i, /\bdecor\b/i, /furniture/i,
  /restaurant/i, /food/i, /catering/i,
];

function shouldKeepJob(job) {
  const title = (job.job_title || '').toLowerCase();
  const company = (job.company || '').toLowerCase();
  if (!title || title.length < 4) return false;
  for (const r of REJECT_TITLE_PATTERNS) {
    if (r.test(title)) return false;
  }
  for (const r of REJECT_COMPANY_PATTERNS) {
    if (r.test(company)) return false;
  }
  return true;
}

module.exports = { shouldKeepJob };
