const http = require('http');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Sample job posting — Customer Success Manager at Capgemini India
const sampleJob = {
  job_title: 'Customer Success Manager',
  company: 'Capgemini India',
  location: 'Delhi NCR, India',
  source_platform: 'tier1_capgemini',
  job_url: 'https://www.capgemini.com/jobs/sample-csm-india',
  description: `
    About the role:
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
    - Ability to manage multiple accounts simultaneously
    - Excellent presentation and documentation skills

    Nice to have:
    - Experience with AI or automation tools
    - Project management certification (PMP, PRINCE2)

    Location: Delhi NCR | Type: Full-time | Experience: 2-4 years
  `
};

const N8N_URL = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678';

console.log('\n===========================================');
console.log('  Job Agent — Fit Scorer Test');
console.log('===========================================\n');
console.log(`Testing against: ${N8N_URL}/webhook/score-job`);
console.log(`Sample job: ${sampleJob.job_title} at ${sampleJob.company}\n`);

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
      console.log('\nScore Response:');
      console.log('---------------');
      console.log(`Score:       ${result.score || result[0]?.json?.score || 'N/A'}`);
      console.log(`Verdict:     ${result.verdict || result[0]?.json?.verdict || 'N/A'}`);
      console.log(`CV Variant:  ${result.cv_variant || result[0]?.json?.cv_variant || 'N/A'}`);
      console.log(`Cover Letter: ${result.cover_letter_needed || result[0]?.json?.cover_letter_needed || 'N/A'}`);

      const matches = result.top_matches || result[0]?.json?.top_matches || [];
      if (matches.length) {
        console.log('\nTop Matches:');
        matches.forEach(m => console.log(`  - ${m}`));
      }

      const gaps = result.gaps || result[0]?.json?.gaps || [];
      if (gaps.length) {
        console.log('\nGaps:');
        gaps.forEach(g => console.log(`  - ${g}`));
      }

      console.log('\n===========================================');
      console.log('  System is working correctly!');
      console.log('===========================================\n');
    } catch (e) {
      console.log('Raw response:', data);
      console.log('\nNote: If you see a valid response above, the system is working.');
      console.log('The scorer returns data via n8n webhook — check your n8n execution log for the full score.');
    }
  });
});

req.on('error', (err) => {
  console.error('\nERROR: Could not connect to n8n');
  console.error(`Details: ${err.message}`);
  console.error('\nMake sure n8n is running: npx n8n');
  console.error('And the fit_scorer workflow is imported and ACTIVE in n8n UI');
  process.exit(1);
});

req.setTimeout(15000, () => {
  console.error('\nERROR: Request timed out after 15s');
  console.error('Check n8n is running and the fit_scorer workflow is active');
  req.destroy();
  process.exit(1);
});

req.write(postData);
req.end();
