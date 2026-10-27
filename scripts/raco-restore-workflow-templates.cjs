// Installs saved templates only. Never activates workflows or sends messages.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const templates = JSON.parse(fs.readFileSync(path.join(__dirname, 'raco-workflow-template-catalog.json'), 'utf8'));
const args = process.argv.slice(2);
const value = (flag) => args[args.indexOf(flag) + 1];

function validateCatalog() {
  assert.equal(templates.length, 9);
  assert.equal(new Set(templates.map(t => t.name)).size, 9);
  const allowed = new Set(['delay', 'aiAgent', 'frontline:mail.drafts.create', 'frontline:inbox.openwaMessages.create']);
  for (const t of templates) {
    const ids = new Set(t.actions.map(a => a.id));
    assert(ids.has(t.entryActionId));
    for (const a of t.actions) {
      assert(allowed.has(a.type), 'Unexpected action: ' + a.type);
      if (a.nextActionId) assert(ids.has(a.nextActionId));
      if (a.type === 'aiAgent') assert.equal(a.config.aiAgentId, '', 'Do not ship tenant-specific agent IDs');
    }
  }
}

async function main() {
  validateCatalog();
  if (args.includes('--check')) {
    console.log('PASS: 9 templates; valid action chains; email drafts only; no embedded agent IDs.');
    return;
  }
  if (!args.includes('--api-url') || !args.includes('--credentials-file')) {
    throw new Error('Use --check, or --api-url https://YOUR-CRM/gateway/graphql --credentials-file /private/owner.json [--apply]. Without --apply this is a read-only dry run.');
  }
  const api = new URL(value('--api-url'));
  const localHttp = args.includes('--allow-local-http') && api.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(api.hostname);
  if ((api.protocol !== 'https:' && !localHttp) || api.username || api.password) throw new Error('Use a trusted HTTPS CRM API URL. Loopback HTTP requires --allow-local-http.');
  const credentials = JSON.parse(fs.readFileSync(path.resolve(value('--credentials-file')), 'utf8'));
  assert.equal(typeof credentials.email, 'string');
  assert.equal(typeof credentials.password, 'string');
  let cookie = '';
  const request = async (query, variables = {}) => {
    const r = await fetch(api, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30000),
      headers: { 'Content-Type': 'application/json', Origin: api.origin, ...(cookie ? { Cookie: cookie } : {}) },
      body: JSON.stringify({ query, variables }),
    });
    const d = await r.json();
    if (!r.ok || d.errors) throw new Error('CRM request rejected (HTTP ' + r.status + '). Check the target, owner account and permissions; no permission changes are attempted.');
    const cookies = r.headers.getSetCookie();
    if (cookies.length) cookie = cookies.map(v => v.split(';')[0]).join('; ');
    return d.data;
  };
  const login = await request('mutation templateRestoreLogin($email:String!,$password:String!){login(email:$email,password:$password)}', credentials);
  assert.equal(login.login, 'loggedIn');
  const user = (await request('query templateRestoreOwner { currentUser { _id isOwner } }')).currentUser;
  assert(user?.isOwner, 'An authorized workspace owner account is required.');
  const list = 'query templateRestoreList { automationWorkflowTemplates { _id name entryActionId actions } }';
  const existing = (await request(list)).automationWorkflowTemplates;
  const missing = templates.filter(t => !existing.some(e => e.name === t.name));
  console.log('Existing templates: ' + existing.length + '; missing catalog templates: ' + missing.length);
  if (!args.includes('--apply')) {
    for (const t of missing) console.log('Would install: ' + t.name);
    console.log('Dry run only. Add --apply to install saved templates.');
    return;
  }
  const before = (await request('query templateRestoreBefore { automations { _id status } }')).automations;
  for (const t of missing) {
    const result = await request('mutation templateRestoreAdd($name:String!,$description:String,$entryActionId:String,$actions:JSON,$inputs:JSON){automationWorkflowTemplatesAdd(name:$name,description:$description,entryActionId:$entryActionId,actions:$actions,inputs:$inputs){_id name}}', t);
    assert(result.automationWorkflowTemplatesAdd?._id, 'Template creation was not confirmed');
    console.log('Installed: ' + t.name);
  }
  const saved = (await request(list)).automationWorkflowTemplates;
  for (const t of templates) assert(saved.some(e => e.name === t.name), 'Missing after import: ' + t.name);
  const after = (await request('query templateRestoreAfter { automations { _id status } }')).automations;
  const ordered = records => records.map(r => ({ id: r._id, status: r.status })).sort((a,b) => a.id.localeCompare(b.id));
  assert.deepEqual(ordered(after), ordered(before), 'Automation status changed during import; inspect concurrent administrator activity.');
  console.log('PASS: catalog present; existing templates preserved; automation IDs/statuses unchanged. Configure deployed inbox/agent bindings before use.');
}
main().catch(() => {
  console.error('Template restoration did not complete. Check the API URL, private credentials file and workspace-owner permissions. The command never enables workflows. A retry preserves existing template names.');
  process.exitCode = 1;
});
