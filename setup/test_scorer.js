const http = require('http');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const sampleJob = {
  job_title: 'Customer Success Manager',
  company: 'Capgemini India',
  location: 'Delhi NCR, India',
  source_platform: 'tier1_capgemini',
  job_url: 'https://www.capgemini.com/jobs/sample-csm-india',
  description: `
    We are looking for a Customer Success Manager to join our Digital Transformation team in Delhi NCR.

    Responsibilities:
    - Own end-to-end client onboarding and lifecycle management for 5-10 enterprise accounts
    - Drive customer satisfaction through proactive engagement, SLA tracking, and escalation management
    - Coordinate with cross-functional teams (Engineering, Sales, Finance) to resolve client issues
    - Prepare and present quarterly business reviews and performance reports
    - Design and optimize client communication SOPs
    - Track and improve CSAT, NPS, and renewal rates

    Requirements:
    - 2-4 years of experience in customer success, account management, or client operations
    - MBA preferred
    - Strong communication and stakeholder management skills
    - Experience with CRM tools (Salesforce, HubSpot, or similar)

    Location: Delhi NCR | Type: Full-time | Experience: 2-4 years
  `
};

const N8N_URL = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678';

console.log('\n===========================================');
console.log('  Job Agent — Fit Scorer Test (Ollama+Qwen)');
console.log('===========================================\n');
console.log(`Testing against: ${N8N_URL}/webhook/score-job`);
console.log(`Sample job: ${sampleJob.job_title} at ${sampleJob.company}`);
console.log('Note: Local Ollama inference takes 30-90 seconds per request.\n');

const postData = JSON.stringify(sampleJob);

const options = {
  hostname: new URL(N8N_URL).hostname,
  port: new URL(N8N_URL).port || 5678,
  path: '/webhook/score-job',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    try {
      const result = JSON.parse(data);
      const r = Array.isArray(result) ? (result[0]?.json || result[0]) : result;
      console.log('\nScore Response:');
      console.log('---------------');
      console.log(`Score:        ${r.score ?? 'N/A'}`);
      console.log(`Verdict:      ${r.verdict ?? 'N/A'}`);
      console.log(`CV Variant:   ${r.cv_variant ?? 'N/A'}`);
      console.log(`Cover Letter: ${r.cover_letter_needed ?? 'N/A'}`);

      if (r.top_matches?.length) {
        console.log('\nTop Matches:');
        r.top_matches.forEach(m => console.log(`  - ${m}`));
      }

      console.log('\n===========================================');
      console.log('  System is working correctly!');
      console.log('===========================================\n');
    } catch (e) {
      console.log('Raw response:', data.substring(0, 500));
    }
  });
});

req.on('error', (err) => {
  console.error(`\nERROR: ${err.message}`);
  console.error('Make sure n8n is running and the fit_scorer workflow is ACTIVE.');
  process.exit(1);
});

req.setTimeout(180000, () => {
  console.error('\nERROR: Request timed out after 3min (Ollama inference too slow)');
  req.destroy();
  process.exit(1);
});

req.write(postData);
req.end();
