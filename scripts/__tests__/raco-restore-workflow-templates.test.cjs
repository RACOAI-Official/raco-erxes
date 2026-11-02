const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const run = promisify(execFile);
const script = path.resolve(__dirname, '../raco-restore-workflow-templates.cjs');

test('template importer is dry-run by default, idempotent on apply and never activates automations', async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'raco-template-test-'));
  const credentials = path.join(folder, 'owner.json');
  fs.writeFileSync(credentials, JSON.stringify({ email: 'owner@example.invalid', password: 'test-fixture-only' }));
  const saved = [];
  let owner = true;
  let writes = 0;
  const operations = [];
  const server = http.createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const { query, variables } = JSON.parse(raw);
    operations.push(query);
    res.setHeader('Content-Type', 'application/json');
    let data;
    if (query.includes('mutation templateRestoreLogin')) {
      res.setHeader('Set-Cookie', 'auth-token=test; HttpOnly');
      data = { login: 'loggedIn' };
    } else {
      assert.equal(req.headers.cookie, 'auth-token=test');
      if (query.includes('currentUser')) data = { currentUser: { _id: 'owner', isOwner: owner } };
      else if (query.includes('mutation templateRestoreAdd')) {
        assert(owner);
        assert(variables.actions.every(a => !['sendEmail', 'frontline:mail.messages.create'].includes(a.type)));
        const record = { ...variables, _id: 'template-' + (++writes) };
        saved.push(record);
        data = { automationWorkflowTemplatesAdd: record };
      } else if (query.includes('automationWorkflowTemplates')) data = { automationWorkflowTemplates: saved };
      else if (query.includes('automations {')) data = { automations: [{ _id: 'untouched-workflow', status: 'draft' }] };
      else throw Error('Unexpected operation: ' + query);
    }
    res.end(JSON.stringify({ data }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const base = [script, '--api-url', `http://127.0.0.1:${address.port}/graphql`, '--credentials-file', credentials, '--allow-local-http'];
  try {
    const dry = await run(process.execPath, base);
    assert(dry.stdout.includes('Dry run only'));
    assert.equal(writes, 0);
    const applied = await run(process.execPath, [...base, '--apply']);
    assert(applied.stdout.includes('automation IDs/statuses unchanged'));
    assert.equal(writes, 11);
    await run(process.execPath, [...base, '--apply']);
    assert.equal(writes, 11, 'Rerun must preserve existing templates without duplicates');
    assert(!operations.some(q => /automations(Add|Edit)|mailDraftApprove|frontlineOpenwaCompose/.test(q)));
    owner = false;
    await assert.rejects(run(process.execPath, [...base, '--apply']));
    assert.equal(writes, 11, 'Non-owner must not write templates');
    console.log('Verified dry-run, eleven draft-safe templates, idempotent rerun, owner requirement and unchanged automation status.');
  } finally {
    await new Promise(resolve => server.close(resolve));
    fs.unlinkSync(credentials);
    fs.rmdirSync(folder);
  }
});
