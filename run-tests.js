/* Runs the real Code.gs against an in-memory fake of SpreadsheetApp / CacheService / UrlFetchApp etc.
   Usage: node backend/test/run-tests.js */
const fs = require('fs'), vm = require('vm'), crypto = require('crypto'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'Code.gs'), 'utf8');

function makeEnv(opts = {}) {
  const props = Object.assign({ SPREADSHEET_ID: 'SHEET1', ANTHROPIC_API_KEY: 'test-key' }, opts.props || {});
  class Range { constructor(s, r, c, nr, nc) { Object.assign(this, { s, r, c, nr, nc }); }
    getValues() { const o = []; for (let i = 0; i < this.nr; i++) { const row = []; for (let j = 0; j < this.nc; j++) row.push(((this.s.data[this.r - 1 + i] || [])[this.c - 1 + j]) ?? ''); o.push(row); } return o; }
    getValue() { return this.getValues()[0][0]; }
    setValues(v) { if (this.s.failWrites) throw new Error('write denied'); v.forEach((row, i) => row.forEach((x, j) => this.put(this.r + i, this.c + j, x))); return this; }
    setValue(x) { if (this.s.failWrites) throw new Error('write denied'); this.put(this.r, this.c, x); return this; }
    put(r, c, x) { while (this.s.data.length < r) this.s.data.push([]); const row = this.s.data[r - 1]; while (row.length < c) row.push(''); row[c - 1] = x; }
    setNumberFormat(f) { for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) this.s.fmt[(this.r + i) + ',' + (this.c + j)] = f; return this; }
    getDataValidation() { return this.s.validation && this.s.validation[this.c] ? { getCriteriaType: () => 'VALUE_IN_LIST', getCriteriaValues: () => [this.s.validation[this.c]] } : null; } }
  class Sheet { constructor(name, rows) { this.name = name; this.data = rows || []; this.fmt = {}; }
    getName() { return this.name; }
    getLastRow() { let n = 0; this.data.forEach((r, i) => { if (r.some(v => v !== '')) n = i + 1; }); return n; }
    getLastColumn() { return this.data.reduce((m, r) => Math.max(m, r.length), 0); }
    getRange(r, c, nr = 1, nc = 1) { return new Range(this, r, c, nr, nc); }
    getDataRange() { return new Range(this, 1, 1, Math.max(this.getLastRow(), 1), Math.max(this.getLastColumn(), 1)); } }
  const sheets = opts.sheets || [];
  const ss = { getSheets: () => sheets, insertSheet: n => { const s = new Sheet(n); sheets.push(s); return s; } };
  const cache = new Map(), pstore = props;
  const mails = [], mail = { quota: 50, fail: false };
  const ai = { calls: 0, handler: opts.ai || (() => ({ reply: 'Thanks! What problem are you solving?', quick_replies: ['Website', 'App'], summary: 'Visitor enquiry.', lead: {}, requirements: {}, ready_to_finalize: false })) };
  const ctx = {
    console, Math, Date, JSON, String, Number, Array, Object, RegExp, Error, isNaN, parseInt,
    SpreadsheetApp: { openById: id => { if (opts.denyAccess || id !== 'SHEET1') throw new Error('No access'); return ss; } },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => pstore[k] ?? null, setProperty: (k, v) => { pstore[k] = v; } }) },
    CacheService: { getScriptCache: () => ({ get: k => cache.get(k) ?? null, put: (k, v) => cache.set(k, v) }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ s, setMimeType() { return this; } }) },
    Utilities: {
      formatDate: (d, tz, f) => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(d).map(x => [x.type, x.value]));
        return f.replace('yyyy', p.year).replace('MM', p.month).replace('dd', p.day).replace('HH', p.hour).replace('mm', p.minute).replace('ss', p.second); },
      computeDigest: (a, s) => [...crypto.createHash('sha256').update(s).digest()].map(b => b > 127 ? b - 256 : b),
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' } },
    UrlFetchApp: { fetch: (url, o) => { ai.calls++; const payload = JSON.parse(o.payload); ai.last = payload;
      const r = ai.handler(payload, ai.calls);
      if (r && r.__http) return { getResponseCode: () => r.__http, getContentText: () => 'err' };
      return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ content: [{ type: 'text', text: typeof r === 'string' ? r : JSON.stringify(r) }] }) }; } },
    MailApp: { sendEmail: o => { if (mail.fail) throw new Error('mail denied'); mails.push(o); }, getRemainingDailyQuota: () => mail.quota },
    Logger: { log() {} }
  };
  vm.createContext(ctx); vm.runInContext(src, ctx);
  const call = body => JSON.parse(ctx.doPost({ postData: { contents: typeof body === 'string' ? body : JSON.stringify(body) } }).s);
  return { ctx, call, sheets, ai, props, mails, mail };
}
const H = {
  leads: ['Lead ID', 'Conversation ID', 'Date & Time', 'Client Name', 'Company', 'Email', 'Phone', 'Country', 'Requested Service', 'Problem Summary', 'Project Requirements', 'Budget', 'Currency', 'Timeline', 'Lead Status', 'Priority', 'Conversation Summary', 'Report Status', 'Assigned Person', 'Follow-up Date'],
  chat: ['Timestamp', 'Client ID', 'Conversation ID', 'Client Name', 'Client Email', 'Sender', 'Message Text', 'Page URL', 'Message ID'], /* Messages tab */
  oldChat: ['Message ID', 'Conversation ID', 'Lead ID', 'Timestamp', 'Sender', 'Message Text', 'Content Type'],
  req: ['Lead ID', 'Conversation ID', 'Project Type', 'Current Problem', 'Expected Solution', 'Requested Features', 'Integrations', 'Target Users', 'Platform', 'Technical Constraints', 'Existing System', 'Success Criteria', 'Missing Information', 'Recommendations', 'Final Report', 'Last Updated']
};
const fresh = (o = {}) => { const e = makeEnv(Object.assign({}, o, { sheets: o.sheets || [mk('All Leads', H.leads), mk('Messages', H.chat), mk('Requirements', H.req), mk('Instructions', null, [['Rule', 'Never promise delivery dates']])] })); return e; };
function mk(name, headers, rows) { const E = makeEnv({}); /* reuse Sheet class via a throwaway env */ const s = E.sheets; const sh = new (Object.getPrototypeOf(E.ctx.SpreadsheetApp.openById('SHEET1').insertSheet('x')).constructor)(name, headers ? [headers.slice()] : (rows || [])); return sh; }
const uid = () => crypto.randomUUID();
let pass = 0, failN = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('  PASS ' + name); } catch (e) { failN++; console.log('  FAIL ' + name + '\n       ' + e.message); } };
const eq = (a, b, m) => { if (a !== b) throw new Error((m || '') + ' expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a)); };
const ok = (c, m) => { if (!c) throw new Error(m || 'assertion failed'); };
const rows = (e, i) => e.sheets[i].data.slice(1).filter(r => r.some(v => v !== ''));
const base = (o = {}) => Object.assign({ action: 'chat', conversation_id: uid(), message_id: uid(), message: 'I need a billing system', lead: {}, history: [] }, o);

console.log('Backend tests (real Code.gs, fake Google services)');
t('ping works and reports config without secrets', () => { const e = fresh(); const r = e.call({ action: 'ping' }); ok(r.ok && r.ai === true && r.sheet === true); ok(!JSON.stringify(r).includes('test-key')); });
t('chat saves lead, customer + assistant messages, requirements', () => {
  const e = fresh({ ai: () => ({ reply: 'Which platform?', quick_replies: ['Web'], summary: 'Billing system enquiry', lead: { name: 'Asha', service: 'Custom Software Development', email: 'asha@x.com' }, requirements: { project_type: 'Billing', missing: 'budget' }, ready_to_finalize: false }) });
  const r = e.call(base()); ok(r.ok && r.saved.ok, JSON.stringify(r));
  eq(rows(e, 0).length, 1); eq(rows(e, 1).length, 2); eq(rows(e, 2).length, 1);
  eq(rows(e, 0)[0][3], 'Asha'); eq(rows(e, 0)[0][5], 'asha@x.com'); eq(rows(e, 1)[0][5], 'Client'); eq(rows(e, 1)[1][5], 'Bot'); eq(rows(e, 2)[0][2], 'Billing');
  eq(rows(e, 0)[0][14], 'New'); eq(rows(e, 0)[0][17], 'Draft');
});
t('IDs have the expected shape', () => { const e = fresh(); const r = e.call(base()); ok(/^LD-\d{8}-[0-9A-F]{6}$/.test(r.ids.lead_id)); ok(/^CNV-[0-9A-F]{10}$/.test(r.ids.conversation_id)); ok(/^MSG-[0-9A-F]{12}$/.test(r.ids.message_id)); });
t('two clients at once never share or overwrite records', () => {
  const e = fresh({ ai: p => ({ reply: 'ok', summary: 's:' + p.messages[p.messages.length - 1].content, lead: { name: p.messages[p.messages.length - 1].content.includes('Alpha') ? 'Alpha' : 'Beta' }, requirements: {} }) });
  const A = { conversation_id: uid(), lead_id: uid() }, B = { conversation_id: uid(), lead_id: uid() };
  const a1 = e.call(base(Object.assign({ message: 'Alpha one' }, A))), b1 = e.call(base(Object.assign({ message: 'Beta one' }, B))), a2 = e.call(base(Object.assign({ message: 'Alpha two' }, A)));
  ok(a1.ids.lead_id === a2.ids.lead_id && a1.ids.lead_id !== b1.ids.lead_id);
  eq(rows(e, 0).length, 2); eq(rows(e, 1).length, 6);
  const alpha = rows(e, 0).find(r => r[0] === a1.ids.lead_id), beta = rows(e, 0).find(r => r[0] === b1.ids.lead_id);
  eq(alpha[3], 'Alpha'); eq(beta[3], 'Beta');
  ok(rows(e, 1).filter(r => r[2] === a1.ids.conversation_id).length === 4 && rows(e, 1).filter(r => r[2] === b1.ids.conversation_id).length === 2);
});
t('retrying the same message creates no duplicates and does not call the AI again', () => {
  const e = fresh(); const b = base(); const r1 = e.call(b), calls = e.ai.calls, r2 = e.call(b);
  eq(e.ai.calls, calls, 'AI calls'); eq(r2.reply, r1.reply); ok(r2.replayed); eq(rows(e, 0).length, 1); eq(rows(e, 1).length, 2); eq(rows(e, 2).length, 1);
});
t('AI outage keeps the visitor message once; retry then completes without duplicates', () => {
  const e = fresh({ ai: (p, n) => n === 1 ? { __http: 529 } : { reply: 'Back!', summary: 's', lead: {}, requirements: {} } }); const b = base();
  const r1 = e.call(b); eq(r1.ok, false); eq(r1.error.code, 'ai_unavailable'); eq(rows(e, 1).length, 1);
  const r2 = e.call(b); ok(r2.ok && r2.saved.ok); eq(rows(e, 1).length, 2); eq(rows(e, 0).length, 1);
});
t('spreadsheet unreachable: reply still returned, but saved is reported false', () => {
  const e = fresh({ denyAccess: true }); const r = e.call(base()); ok(r.ok); eq(r.saved.ok, false); eq(r.saved.error, 'sheet_unavailable');
});
t('write failure after the AI reply is reported honestly', () => {
  const e = fresh({ ai: () => { e.sheets[1].failWrites = true; return { reply: 'hi', summary: '', lead: {}, requirements: {} }; } }); const r = e.call(base()); ok(r.ok); eq(r.saved.ok, false); eq(r.saved.error, 'sheet_write_failed');
});
t('AI not configured returns a clear error, visitor message still saved', () => {
  const e = fresh({ props: { ANTHROPIC_API_KEY: '' } }); const r = e.call(base()); eq(r.ok, false); eq(r.error.code, 'ai_not_configured'); eq(rows(e, 1).length, 1);
});
t('invalid email/phone from the AI are dropped, nothing invented', () => {
  const e = fresh({ ai: () => ({ reply: 'ok', lead: { email: 'not-an-email', phone: 'abc', name: 'Ravi' }, requirements: {} }) }); const r = e.call(base()); eq(r.lead_update.email, ''); eq(r.lead_update.phone, ''); eq(rows(e, 0)[0][5] || '', ''); eq(rows(e, 0)[0][3], 'Ravi');
});
t('formula-like text is stored as plain text (text number format)', () => {
  const e = fresh(); e.call(base({ message: '=HYPERLINK("http://evil","x")' })); const sh = e.sheets[1]; const row = sh.data.findIndex(r => String(r[6]).startsWith('=')) + 1; ok(row > 0); eq(sh.fmt[row + ',7'], '@');
});
t('non-JSON AI output is shown as plain reply, no fields invented', () => { const e = fresh({ ai: () => 'Sure, tell me more.' }); const r = e.call(base()); eq(r.reply, 'Sure, tell me more.'); eq(rows(e, 0)[0][3] || '', ''); });
t('input validation: bad ids, empty/oversized message, bad JSON, unknown action', () => {
  const e = fresh(); eq(e.call(base({ conversation_id: 'x' })).error.code, 'bad_request'); eq(e.call(base({ message_id: '!!' })).error.code, 'bad_request');
  eq(e.call(base({ message: '   ' })).error.code, 'bad_request'); eq(e.call('not json').error.code, 'bad_request'); eq(e.call({ action: 'nope' }).error.code, 'bad_request');
  eq(e.call(base({ message: 'x'.repeat(5000) })).ok, true); const msg = rows(e, 1)[0][6]; eq(msg.length, 1000);
  eq(e.call({ action: 'chat', pad: 'x'.repeat(100000) }).error.code, 'payload_too_large');
});
t('honeypot, shared token and rate limits', () => {
  let e = fresh(); eq(e.call(base({ website: 'spam.com' })).error.code, 'rejected');
  e = fresh({ props: { CLIENT_TOKEN: 'abc' } }); eq(e.call(base()).error.code, 'unauthorized'); ok(e.call(base({ token: 'abc' })).ok);
  e = fresh(); const cid = uid(); let last; for (let i = 0; i < 62; i++) last = e.call(base({ conversation_id: cid })); eq(last.error.code, 'rate_limited');
  e = fresh({ props: { DAILY_AI_LIMIT: '2' } }); e.call(base()); e.call(base()); eq(e.call(base()).error.code, 'ai_budget');
});
t('timestamps are Asia/Kolkata (UTC+05:30)', () => {
  const e = fresh(); e.call(base()); const ts = rows(e, 1)[0][0]; ok(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(ts), ts);
  const ist = new Date(ts.replace(' ', 'T') + '+05:30').getTime(); ok(Math.abs(ist - Date.now()) < 5000, 'diff ' + (ist - Date.now()));
});
t('finalize writes final report, sets priority, keeps human-owned status', () => {
  const full = { reply: 'ok', summary: 'run', lead: { name: 'Meera', email: 'm@x.com', service: 'Mobile Application', requirements: 'Android app for deliveries with live tracking and payments', budget: '₹5 lakh', timeline: '3 months' }, requirements: { project_type: 'Mobile', missing: 'users' } };
  const e = fresh({ ai: p => /final records/.test(p.messages[p.messages.length - 1].content) ? Object.assign({}, full, { final_report: 'Overview...\nAI recommendations: ...', summary: 'Final summary' }) : full });
  const A = { conversation_id: uid(), lead_id: uid() }; const m1 = base(A); const r1 = e.call(m1);
  e.sheets[0].data[1][14] = 'Contacted'; /* human changes status */
  const hist = [{ message_id: m1.message_id, sender_type: 'customer', message_text: m1.message, timestamp: new Date().toISOString() }];
  const f = e.call({ action: 'finalize', conversation_id: A.conversation_id, lead_id: A.lead_id, history: hist, lead: {}, reason: 'completed' });
  ok(f.ok && f.saved.ok && f.ai_report, JSON.stringify(f)); const L = rows(e, 0)[0];
  eq(L[14], 'Contacted', 'status preserved'); eq(L[17], 'Final'); eq(L[15], 'High'); eq(L[16], 'Final summary'); ok(rows(e, 2)[0][14].includes('AI recommendations')); eq(rows(e, 0).length, 1); eq(rows(e, 1).length, 2, 'no duplicate chat rows after finalize');
  const f2 = e.call({ action: 'finalize', conversation_id: A.conversation_id, lead_id: A.lead_id, history: hist, reason: 'left' }); ok(f2.ok); eq(rows(e, 0).length, 1); eq(rows(e, 1).length, 2); eq(rows(e, 0)[0][17], 'Incomplete - visitor left');
});
t('finalize with no visitor messages is rejected; with sheet down it fails honestly', () => {
  let e = fresh(); eq(e.call({ action: 'finalize', conversation_id: uid(), history: [] }).error.code, 'bad_request');
  e = fresh({ denyAccess: true }); const h = [{ message_id: uid(), sender_type: 'customer', message_text: 'hi', timestamp: new Date().toISOString() }]; const r = e.call({ action: 'finalize', conversation_id: uid(), history: h }); eq(r.ok, false); eq(r.error.code, 'sheet_unavailable');
});
t('finalize without AI still saves the facts and says so in Report Status', () => {
  const e = fresh({ props: { ANTHROPIC_API_KEY: '' } }); const id = uid(); const h = [{ message_id: id, sender_type: 'customer', message_text: 'hello', timestamp: new Date().toISOString() }];
  const r = e.call({ action: 'finalize', conversation_id: uid(), history: h, lead: { name: 'Zed' } }); ok(r.ok && !r.ai_report); eq(rows(e, 0)[0][17], 'Draft (no AI report)'); ok(rows(e, 2)[0][14].includes('no AI analysis'));
});
t('legacy guided "lead" submission saves everything and is retry-safe', () => {
  const e = fresh({ props: { ANTHROPIC_API_KEY: '' } }); const c = uid(), l = uid(), now = new Date().toISOString();
  const p = { action: 'lead', lead_id: l, conversation_id: c, customer: { name: 'Kiran', email: 'k@x.com', phone: '+91 98765 43210' }, project_type: 'Website Design', requirements_summary: 'E-commerce store', estimated_budget: 'Not decided yet', expected_timeline: 'Flexible',
    messages: [{ message_id: uid(), sender_type: 'assistant', message_text: 'Hi', timestamp: now }, { message_id: uid(), sender_type: 'customer', message_text: 'I need a store', timestamp: now }] };
  const r1 = e.call(p), r2 = e.call(p); ok(r1.ok && r2.ok); eq(rows(e, 0).length, 1); eq(rows(e, 1).length, 2); eq(rows(e, 0)[0][6], '+91 98765 43210'); eq(rows(e, 0)[0][8], 'Website Design');
});
t('existing sheet conventions: dropdown status and different header names respected', () => {
  const lh = H.leads.map(h => h === 'Client Name' ? 'Name' : h).filter(h => h !== 'Follow-up Date');
  const leads = mk('Leads', lh); leads.validation = { 15: ['Open', 'New Lead', 'Won'] }; leads.validation[lh.indexOf('Lead Status') + 1] = ['Open', 'New Lead', 'Won'];
  const e = fresh({ sheets: [leads, mk('Messages', H.chat), mk('Requirements', H.req)], ai: () => ({ reply: 'hi', lead: { name: 'Neel' }, requirements: {} }) });
  const r = e.call(base()); ok(r.ok && r.saved.ok); ok(r.setup_notes.some(n => /Follow-up Date/.test(n))); eq(rows(e, 0)[0][lh.indexOf('Name')], 'Neel'); eq(rows(e, 0)[0][lh.indexOf('Lead Status')], 'New Lead');
});
t('missing tabs are created with the standard headers and reported', () => {
  const e = fresh({ sheets: [] }); const r = e.call(base()); ok(r.saved.ok); eq(e.sheets.length, 3); ok(r.setup_notes.length === 3); eq(e.sheets[0].data[0][0], 'Lead ID');
});
t('Instructions tab text is passed to the AI', () => { const e = fresh(); e.call(base()); ok(e.ai.last.system.includes('Never promise delivery dates')); });
t('system prompt forbids inventing facts and the key is never in the prompt', () => { const e = fresh(); e.call(base()); ok(/Never invent/.test(e.ai.last.system)); ok(!e.ai.last.system.includes('test-key')); });
t('history is converted to strictly alternating turns ending with the visitor', () => {
  const e = fresh(); const h = [{ message_id: uid(), sender_type: 'assistant', message_text: 'Welcome', timestamp: new Date().toISOString() }, { message_id: uid(), sender_type: 'customer', message_text: 'A', timestamp: new Date().toISOString() }, { message_id: uid(), sender_type: 'customer', message_text: 'B', timestamp: new Date().toISOString() }];
  e.call(base({ history: h, message: 'C' })); const m = e.ai.last.messages; eq(m[0].role, 'user'); eq(m[m.length - 1].role, 'user'); m.forEach((x, i) => i && eq(x.role === m[i - 1].role, false));
});
t('visitor language is passed to the AI; team-facing fields are requested in English', () => {
  const e = fresh(); e.call(base({ lang: 'ja' })); ok(/Japanese/.test(e.ai.last.system)); ok(/ENGLISH for the Riddhix team/.test(e.ai.last.system));
  const e2 = fresh(); e2.call(base({ lang: 'xx' })); ok(/website language is English/.test(e2.ai.last.system));
});

/* ---- Messages tab: Client ID, Page URL, Client/Bot, ordering, retries ---- */
t('Messages rows carry timestamp, client id, conversation id, name, email, sender, text, page url (in order)', () => {
  const e = fresh({ ai: () => ({ reply: 'Hi Asha!', summary: 's', lead: { name: 'Asha', email: 'asha@x.com' }, requirements: {} }) });
  const client = uid(), url = 'https://riddhix.com/index.html?lang=en';
  const r = e.call(base({ client_id: client, page_url: url, message: 'Hello there' })); ok(r.saved.ok);
  const m = rows(e, 1); eq(m.length, 2);
  ok(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(m[0][0])); eq(m[0][1], client); eq(m[0][2], r.ids.conversation_id); eq(m[0][3], ''); eq(m[0][4], ''); eq(m[0][5], 'Client'); eq(m[0][6], 'Hello there'); eq(m[0][7], url);
  eq(m[1][1], client); eq(m[1][3], 'Asha'); eq(m[1][4], 'asha@x.com'); eq(m[1][5], 'Bot'); eq(m[1][6], 'Hi Asha!'); eq(m[1][7], url); ok(m[0][0] <= m[1][0]);
});
t('same Client ID across two conversations, different Conversation IDs; one tab holds every client', () => {
  const e = fresh(); const client = uid(), other = uid();
  const a = e.call(base({ client_id: client })), b = e.call(base({ client_id: client })), c = e.call(base({ client_id: other }));
  const m = rows(e, 1); eq(m.length, 6); eq(e.sheets.length, 4); ok(a.ids.conversation_id !== b.ids.conversation_id);
  eq(m.filter(r => r[1] === client).length, 4); eq(m.filter(r => r[1] === other).length, 2);
});
t('invalid client id / non-http page url are stored blank, never as given', () => {
  const e = fresh(); e.call(base({ client_id: '<script>', page_url: 'javascript:alert(1)' })); const m = rows(e, 1)[0]; eq(m[1], ''); eq(m[7], '');
});
t('messages keep chronological row order over several turns', () => {
  const e = fresh({ ai: (p, n) => ({ reply: 'bot' + n, summary: '', lead: {}, requirements: {} }) }); const A = { conversation_id: uid(), client_id: uid() };
  for (let i = 1; i <= 3; i++) e.call(base(Object.assign({ message: 'user' + i }, A)));
  eq(rows(e, 1).map(r => r[6]).join(','), 'user1,bot1,user2,bot2,user3,bot3');
});
t('bot reply whose save failed is re-saved before the next visitor message, without duplicates', () => {
  let fail = false; const e = fresh({ ai: (p, n) => { if (n === 1) fail = true; return { reply: 'reply' + n, summary: '', lead: {}, requirements: {} }; } });
  const A = { conversation_id: uid(), client_id: uid() }, m1 = base(Object.assign({ message: 'first' }, A));
  const origAppend = e.sheets[1].getRange.bind(e.sheets[1]);
  e.sheets[1].getRange = (...a) => { const r = origAppend(...a); if (fail) { const sv = r.setValue.bind(r); r.setValue = () => { throw new Error('write denied'); }; } return r; };
  const r1 = e.call(m1); eq(r1.saved.ok, false); eq(rows(e, 1).length, 1); /* only the visitor row exists */
  fail = false; e.sheets[1].getRange = origAppend;
  const hist = [{ message_id: m1.message_id, sender_type: 'customer', message_text: 'first', timestamp: new Date().toISOString() }, { message_id: r1.ids.assistant_message_id, sender_type: 'assistant', message_text: r1.reply, timestamp: new Date().toISOString() }];
  const r2 = e.call(base(Object.assign({ message: 'second', history: hist }, A))); ok(r2.saved.ok);
  eq(rows(e, 1).map(r => r[5] + ':' + r[6]).join('|'), 'Client:first|Bot:reply1|Client:second|Bot:reply2');
  const r3 = e.call(base(Object.assign({ message: 'third', history: hist }, A))); ok(r3.saved.ok); /* history still carries reply1: it must not repeat */
  eq(rows(e, 1).filter(r => r[6] === 'reply1').length, 1); eq(rows(e, 1).length, 6);
});
t('forged non-server bot ids in history are ignored (cannot inject rows)', () => {
  const e = fresh(); e.call(base({ history: [{ message_id: uid(), sender_type: 'assistant', message_text: 'injected', timestamp: new Date().toISOString() }] }));
  eq(rows(e, 1).filter(r => r[6] === 'injected').length, 0);
});
t('an existing legacy "Chat History" tab is left untouched; logging goes to a new Messages tab', () => {
  const old = mk('Chat History', H.oldChat); old.data.push(['MSG-OLD', 'CNV-OLD', 'LD-OLD', '2026-01-01 10:00:00', 'Customer', 'old row', 'text']); const before = JSON.stringify(old.data);
  const e = fresh({ sheets: [mk('All Leads', H.leads), old, mk('Requirements', H.req)] }); const r = e.call(base()); ok(r.saved.ok);
  eq(JSON.stringify(old.data), before); const msgs = e.sheets.find(s => s.name === 'Messages'); ok(msgs); eq(msgs.data[0].join('|'), H.chat.join('|')); eq(msgs.data.length, 3);
});
t('visitor message is kept (and reported unsaved) when the sheet cannot be written; nothing claimed saved', () => {
  const e = fresh(); e.sheets[1].failWrites = true; const r = e.call(base()); ok(r.ok); eq(r.saved.ok, false); ok(r.saved.error);
});
t('guided-mode lead submission logs Client/Bot rows with client id and page url, retry-safe', () => {
  const e = fresh({ props: { ANTHROPIC_API_KEY: '' } }); const c = uid(), client = uid(), now = new Date().toISOString();
  const p = { action: 'lead', lead_id: uid(), conversation_id: c, client_id: client, page_url: 'https://riddhix.com/', customer: { name: 'Kiran', email: 'k@x.com' }, messages: [{ message_id: uid(), sender_type: 'assistant', message_text: 'Hi', timestamp: now }, { message_id: uid(), sender_type: 'customer', message_text: 'store', timestamp: now }] };
  e.call(p); e.call(p); const m = rows(e, 1); eq(m.length, 2); eq(m[0][5], 'Bot'); eq(m[1][5], 'Client'); eq(m[1][1], client); eq(m[1][3], 'Kiran'); eq(m[1][7], 'https://riddhix.com/');
});

/* ---- email copy of finished enquiries ---- */
const finalizeBody = (e, extra = {}) => { const A = { conversation_id: uid(), lead_id: uid(), client_id: uid() }; const m = base(A); e.call(m);
  return Object.assign({ action: 'finalize', page_url: 'https://riddhix.com/', lead: { name: 'Meera', email: 'm@x.com' }, reason: 'completed', history: [{ message_id: m.message_id, sender_type: 'customer', message_text: m.message, timestamp: new Date().toISOString() }] }, A, extra); };
t('finalize emails client data + conversation to NOTIFY_EMAIL once; retry does not resend', () => {
  const e = fresh({ props: { NOTIFY_EMAIL: 'siddhiworki830@gmail.com' } }); const f = finalizeBody(e); const r = e.call(f);
  ok(r.ok && r.notified.ok, JSON.stringify(r.notified)); eq(e.mails.length, 1); eq(e.mails[0].to, 'siddhiworki830@gmail.com'); ok(/Meera/.test(e.mails[0].body) && /m@x\.com/.test(e.mails[0].body) && /I need a billing system/.test(e.mails[0].body)); eq(e.mails[0].replyTo, 'm@x.com');
  const r2 = e.call(f); ok(r2.ok && r2.notified.duplicate); eq(e.mails.length, 1);
});
t('no NOTIFY_EMAIL: sheet still saved, notification reported as skipped (not pretended)', () => { const e = fresh(); const r = e.call(finalizeBody(e)); ok(r.ok && r.saved.ok); eq(r.notified.ok, false); eq(r.notified.skipped, true); eq(e.mails.length, 0); });
t('mail failure or quota never undoes the sheet save and is reported', () => {
  let e = fresh({ props: { NOTIFY_EMAIL: 'a@x.com' } }); e.mail.fail = true; let r = e.call(finalizeBody(e)); ok(r.ok && r.saved.ok); eq(r.notified.ok, false); eq(r.notified.error, 'mail_failed');
  e = fresh({ props: { NOTIFY_EMAIL: 'a@x.com' } }); e.mail.quota = 0; r = e.call(finalizeBody(e)); ok(r.saved.ok); eq(r.notified.error, 'mail_quota');
});
t('several/invalid notify addresses: valid ones used; subject cannot be header-injected', () => {
  const e = fresh({ props: { NOTIFY_EMAIL: 'a@x.com, bad, b@y.org' } }); const f = finalizeBody(e, { lead: { name: 'Eve\r\nBcc: evil@x.com', email: 'e@x.com' } }); e.call(f);
  eq(e.mails[0].to, 'a@x.com,b@y.org'); ok(!/[\r\n]/.test(e.mails[0].subject));
});
t('guided "lead" submission also emails the enquiry', () => {
  const e = fresh({ props: { ANTHROPIC_API_KEY: '', NOTIFY_EMAIL: 'a@x.com' } }); const now = new Date().toISOString();
  const r = e.call({ action: 'lead', lead_id: uid(), conversation_id: uid(), client_id: uid(), customer: { name: 'Kiran', email: 'k@x.com' }, project_type: 'Website Design', messages: [{ message_id: uid(), sender_type: 'customer', message_text: 'I need a store', timestamp: now }] });
  ok(r.ok && r.notified.ok); eq(e.mails.length, 1); ok(/Kiran/.test(e.mails[0].body));
});
console.log(`\n${pass} passed, ${failN} failed`); process.exit(failN ? 1 : 0);
