import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OperationalStore } from '../lib/operational-store.mjs';
import { money } from '../lib/demo.mjs';

const scout = { id:'scout', role:'talent_ops' };
const finance = { id:'finance', role:'finance' };
const executive = { id:'executive', role:'executive' };
const partner = { id:'partner', role:'partner' };
const due = '2026-11-30';
const setup = db => {
  const account = db.createAccount(scout,{partnerName:'Brand',entityName:'Legal Entity',agreementLabel:'v1'});
  const req = db.createRequirement(scout,{...account,title:'Synthetic role',owner:scout.id});
  const candidate = db.addCandidate(scout,'Fictional Candidate');
  return {account, req, consideration:db.consider(scout,candidate,req)};
};

test('upgrade preserves existing actions, appends blocked and failed evidence, and rejects stale edits', t => {
  const dir = mkdtempSync(join(tmpdir(),'phase-three-'));
  t.after(()=>rmSync(dir,{force:true,recursive:true}));
  const file = join(dir,'local.sqlite');
  const legacy = new DatabaseSync(file);
  legacy.exec(`CREATE TABLE action(id TEXT PRIMARY KEY,subject TEXT NOT NULL,action_type TEXT NOT NULL,
    owner TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('open','completed')),
    due TEXT NOT NULL,next_action TEXT NOT NULL,evidence TEXT NOT NULL,updated_at TEXT NOT NULL);
    CREATE TABLE action_event(id TEXT PRIMARY KEY,action_id TEXT NOT NULL REFERENCES action(id),
    kind TEXT NOT NULL,actor TEXT NOT NULL,recorded_at TEXT NOT NULL,detail TEXT NOT NULL);
    INSERT INTO action VALUES ('legacy','demo','check','scout','open','2026-11-30','Call','','2026-11-17');
    INSERT INTO action_event VALUES ('created','legacy','created','scout','2026-11-17','');`);
  legacy.close();
  const a = new OperationalStore(file), b = new OperationalStore(file);
  t.after(()=>{a.close();b.close()});
  assert.equal(b.listActions(scout)[0].version,0);
  assert.throws(()=>a.transitionAction(scout,'legacy',{status:'blocked',expectedVersion:0}),/INVALID_TRANSITION/);
  const blocked = a.transitionAction(scout,'legacy',{status:'blocked',expectedVersion:0,
    blocker:'Await signed document',blockerOwner:'demo counterparty',reviewDate:'2026-11-25',nextAction:'Review reply'});
  assert.equal(a.followUpQueue(scout,'2026-11-18')[0].review_date,'2026-11-25');
  assert.throws(()=>b.transitionAction(scout,'legacy',{status:'in_progress',expectedVersion:0}),/STALE_RECORD/);
  const active = b.transitionAction(scout,'legacy',{status:'in_progress',expectedVersion:blocked.version});
  assert.throws(()=>a.transitionAction(scout,'legacy',{status:'failed',reason:'no_response',
    expectedVersion:active.version}),/INVALID_TRANSITION/);
  a.transitionAction(scout,'legacy',{status:'failed',reason:'no_response',outcome:'Attempt received no reply',
    certainty:'reported',reportedBy:'Demo operator',expectedVersion:active.version});
  assert.equal(b.listActions(scout,{status:'failed'}).length,1);
  assert.equal(b.listOutcomes(scout,'action','legacy')[0].reason,'no_response');
  assert.match(b.actionHistory(scout,'legacy')[1].detail,/Await signed document/);
});

test('requirement reopening reuses the record and criteria stay tied to its consideration', t => {
  const db = new OperationalStore(); t.after(()=>db.close());
  const {account, req, consideration} = setup(db);
  assert.throws(()=>db.transitionRequirement(scout,req,{expectedVersion:0,status:'filled'}),/INVALID_TRANSITION/);
  db.transitionRequirement(scout,req,{expectedVersion:0,status:'brief_confirmed'});
  db.transitionRequirement(scout,req,{expectedVersion:1,status:'sourcing'});
  db.transitionRequirement(scout,req,{expectedVersion:2,status:'paused',reason:'hiring_paused'});
  assert.equal(db.transitionRequirement(scout,req,{expectedVersion:3,status:'sourcing'}).id,req);
  const second = db.createRequirement(scout,{...account,title:'Other role',owner:scout.id});
  const other = db.addCriterion(scout,{requirementId:second,label:'Different scope',relevance:'Another role'});
  const criterionId = db.addCriterion(scout,{requirementId:req,label:'Document a handoff',relevance:'Core support duty'});
  const review = {considerationId:consideration,criterionId,observation:'Identified open items',evidence:'Synthetic exercise',
    reviewedOn:'2026-11-18',recommendation:'Review further evidence',recommendationReason:'One condition untested'};
  assert.throws(()=>db.recordAssessment(scout,{...review,criterionId:other}),/CRITERION_REQUIREMENT_MISMATCH/);
  db.recordAssessment(scout,review);
  assert.equal(db.listAssessments(scout,consideration)[0].reviewer,scout.id);
  assert.throws(()=>db.listAssessments(partner,consideration),/FORBIDDEN/);
  const release = db.introduce(scout,consideration,{evidence:'Released fixture',introducedOn:'2026-11-18',
    method:'Email',followUpOwner:scout.id});
  assert.equal(db.introductionHistory(scout,consideration)[0].id,release);
  const event = db.recordOutcome(scout,{recordType:'introduction',recordId:release,outcome:'Candidate declined',reason:'unknown'});
  const corrected = {recordType:'introduction',recordId:release,outcome:'Candidate declined',supersedes:event,
    reason:'compensation_mismatch',certainty:'confirmed'};
  assert.throws(()=>db.recordOutcome(scout,corrected),/source/);
  db.recordOutcome(scout,{...corrected,reportedBy:'Candidate',evidence:'Synthetic confirmation'});
  assert.throws(()=>db.recordOutcome(scout,corrected),/STALE_CORRECTION/);
  assert.deepEqual(db.outcomeReport(scout,'introduction').map(x=>x.certainty),['confirmed']);
  assert.equal(db.listOutcomes(scout,'introduction',release).length,2);
});

test('invoice trace pins its legal entity and agreement, adjustments reverse, and follow-ups never post cash', t => {
  const db = new OperationalStore(); t.after(()=>db.close());
  const {account,consideration} = setup(db);
  const entityId = db.addLegalEntity(scout,account.partnerId,{name:'Second legal entity'});
  const agreementId = db.addAgreement(scout,{partnerId:account.partnerId,entityId});
  db.addAgreementVersion(scout,{agreementId,label:'Draft',executionState:'draft'});
  db.addAgreementVersion(scout,{agreementId:account.agreementId,label:'v2',executionState:'executed',termsReference:'Synthetic signed v2'});
  assert.equal(db.partnerRelationships(scout,account.partnerId).length,3);
  const placementId = db.place(scout,{considerationId:consideration,actualDate:'2026-11-18',evidence:'Synthetic start'});
  const entitlementId = db.createEntitlement(finance,{placementId,estimated:25001,earned:25001,currency:'INR',basis:'Synthetic approved item'});
  const invoiceId = db.createInvoice(finance,{entitlementId,number:'DEMO-006',gross:25001,currency:'INR',due});
  const receiptId = db.recordReceipt(finance,{reference:'SYNTHETIC',receivedAt:'2026-11-18',amount:10000,currency:'INR'});
  const allocated = db.allocate(finance,{receiptId,invoiceId,amount:10000,key:'allocated'});
  const adjustment = db.adjustInvoice(finance,invoiceId,{amount:-5001,reason:'Credit',evidence:'Demo adjustment'});
  assert.equal(db.invoiceBalance(finance,invoiceId).open,10000);
  assert.throws(()=>db.adjustInvoice(finance,invoiceId,{amount:-10001,reason:'Over-credit',evidence:'Demo'}),/INVALID_ADJUSTMENT/);
  db.adjustInvoice(finance,invoiceId,{reverses:adjustment,reason:'Correction',evidence:'Demo reversal'});
  db.reverseAllocation(finance,allocated,'Review allocation');
  const trace = db.invoiceTrace(finance,invoiceId);
  assert.equal(trace.invoice.open,25001);
  assert.equal(trace.agreement.id,account.versionId);
  assert.equal(trace.agreement.legal_entity,'Legal Entity');
  assert.equal(trace.lines[0].basis,'Synthetic approved item');
  assert.equal(trace.receipts[0].reversal_reason,'Review allocation');
  assert.equal(trace.adjustments.length,2);
  db.recordOutcome(finance,{recordType:'collection',recordId:invoiceId,reason:'reminder_sent',outcome:'Sent'});
  assert.equal(db.invoiceBalance(finance,invoiceId).open,25001);
  assert.throws(()=>db.invoiceTrace(scout,invoiceId),/FORBIDDEN/);
  const task = db.addAction(executive,{subjectType:'collection',subject:invoiceId,
    actionType:'Reminder',owner:'executive',due,nextAction:'Request status'});
  assert.equal(db.listActions(scout).length,0);
  assert.throws(()=>db.recordOutcome(scout,{recordType:'action',recordId:task,outcome:'test'}),/FORBIDDEN/);
  assert.throws(()=>db.listOutcomes(scout,'collection',invoiceId),/FORBIDDEN/);
  assert.equal(money(25001),'₹250.01');
});
