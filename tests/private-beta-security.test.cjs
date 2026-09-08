// Synthetic demo data only; run with the isolated security emulator runner.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, getDoc, getDocs, collection, query, where, setDoc, updateDoc, deleteDoc, serverTimestamp, deleteField } = require('node:module').createRequire(require.resolve('@firebase/rules-unit-testing'))('firebase/firestore');
const host = process.env.FIRESTORE_EMULATOR_HOST;
assert.match(host || '', /^(127\.0\.0\.1|localhost):\d+$/, 'Refuse non-local/missing emulator');
const root = path.resolve(__dirname, '..');
const rulesPath = fs.existsSync(path.join(root, 'firebase/firestore.rules')) ? path.join(root, 'firebase/firestore.rules') : path.join(root, 'firestore.rules');
const projectId = 'demo-filwest-security-' + (rulesPath.includes('/firebase/') ? 'app' : 'site');
let env;
const db = uid => uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore();
// Payload contracts: app/utils/moderation.ts, site/src/lib/reports.ts;
// admin queue and resolve: site/src/lib/moderation.ts.
const reportPayload = (extra = {}) => ({ reporterId: 'alice', targetId: 'bob', reason: 'fake', status: 'open', createdAt: serverTimestamp(), ...extra });
const report = uid => doc(db(uid), 'reports', 'submission');
const match = uid => doc(db(uid), 'matches', 'alice_bob');
const message = uid => doc(db(uid), 'matches', 'alice_bob', 'messages', 'private');
before(async () => {
  const [hostname, port] = host.split(':');
  env = await initializeTestEnvironment({ projectId, firestore: { host: hostname, port: Number(port), rules: fs.readFileSync(rulesPath, 'utf8') } });
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const store = context.firestore();
    await setDoc(doc(store, 'matches', 'alice_bob'), { user1Id: 'alice', user2Id: 'bob', lastMessage: 'Private', lastMessageTime: serverTimestamp() });
    await setDoc(doc(store, 'matches', 'alice_bob', 'messages', 'private'), { senderId: 'bob', text: 'Private history', isRead: false });
    await setDoc(doc(store, 'admins', 'moderator'), { enabled: true });
  });
});
after(async () => { if (env) await env.cleanup(); });

for (const status of ['closed', 'resolved', 'pending', null]) {
  test(`client cannot create report with status ${status}`, async () => {
    await assertFails(setDoc(report('alice'), reportPayload({ status })));
  });
}
test('client cannot omit report status and bypass open moderation queue', async () => {
  const payload = reportPayload(); delete payload.status;
  await assertFails(setDoc(report('alice'), payload));
});
for (const reason of ['fake', 'money', 'abusive', 'other']) {
  test(`web open report ${reason} reaches admin queue`, async () => {
    await assertSucceeds(setDoc(report('alice'), reportPayload({ reason, details: 'Synthetic report', matchId: 'alice_bob', messageId: 'private', messageText: 'Private history' })));
    const queue = await assertSucceeds(getDocs(query(collection(db('moderator'), 'reports'), where('status', '==', 'open'))));
    assert.deepEqual(queue.docs.map(d => d.id), ['submission']);
    assert.equal(queue.docs[0].data().reason, reason);
  });
}
for (const reason of ['inappropriate_photos', 'fake_profile', 'harassment', 'spam', 'underage', 'scam', 'other']) {
  test(`mobile open report ${reason} preserves mobile aliases`, async () => {
    await assertSucceeds(setDoc(report('alice'), reportPayload({ reason, reportedUserId: 'bob', details: '', timestamp: serverTimestamp() })));
    const saved = (await assertSucceeds(getDoc(report('moderator')))).data();
    assert.equal(saved.reason, reason);
    assert.equal(saved.reportedUserId, 'bob');
    assert.equal(saved.status, 'open');
  });
}
test('web minimal open report does not require optional details', async () => {
  await assertSucceeds(setDoc(report('alice'), reportPayload()));
});
for (const uid of [null, 'outsider']) {
  test(`${uid || 'anonymous'} cannot forge another reporter`, async () => { await assertFails(setDoc(report(uid), reportPayload())); });
}
test('member cannot submit a system auto-flag', async () => {
  await assertFails(setDoc(report('alice'), reportPayload({ reporterId: 'system', reason: 'auto' })));
});
test('allowlisted admin resolves open report using actual admin payload', async () => {
  await assertSucceeds(setDoc(report('alice'), reportPayload()));
  await assertSucceeds(updateDoc(report('moderator'), { status: 'resolved', action: 'dismissed', resolvedAt: serverTimestamp() }));
  const saved = (await getDoc(report('moderator'))).data();
  assert.equal(saved.status, 'resolved');
  assert.equal(saved.action, 'dismissed');
  assert.ok(saved.resolvedAt);
  assert.equal((await getDocs(query(collection(db('moderator'), 'reports'), where('status', '==', 'open')))).size, 0);
});
test('reporter cannot resolve or read the moderation queue', async () => {
  await assertSucceeds(setDoc(report('alice'), reportPayload()));
  await assertFails(updateDoc(report('alice'), { status: 'resolved', action: 'dismissed', resolvedAt: serverTimestamp() }));
  await assertFails(getDocs(collection(db('alice'), 'reports')));
});

for (const [uid, field] of [['alice', 'user2Id'], ['bob', 'user1Id']]) {
  test(`${uid} cannot invite outsider into private history by replacing ${field}`, async () => {
    await assertFails(getDoc(message('outsider')));
    await assertFails(updateDoc(match(uid), { [field]: 'outsider' }));
    await assertFails(getDoc(message('outsider')));
    assert.equal((await getDoc(message(uid))).data().text, 'Private history');
  });
}
for (const [label, change] of Object.entries({ selfReplacement: { user1Id: 'outsider' }, swap: { user1Id: 'bob', user2Id: 'alice' }, deletion: { user2Id: deleteField() }, nullParticipant: { user2Id: null } })) {
  test(`match update rejects ${label}`, async () => { await assertFails(updateDoc(match('alice'), change)); });
}
test('full document replacement cannot transfer both participants', async () => {
  await assertFails(setDoc(match('alice'), { user1Id: 'outsider', user2Id: 'another' }));
});
for (const uid of ['alice', 'bob']) {
  test(`${uid} can send and update real app/site chat summary fields`, async () => {
    await assertSucceeds(setDoc(doc(db(uid), 'matches', 'alice_bob', 'messages', 'new'), { senderId: uid, text: 'Hello', timestamp: serverTimestamp(), isRead: false }));
    await assertSucceeds(updateDoc(match(uid), { lastMessage: 'Hello', lastMessageTime: serverTimestamp() }));
    const saved = (await getDoc(match(uid))).data();
    assert.equal(saved.lastMessage, 'Hello');
    assert.equal(saved.user1Id, 'alice');
    assert.equal(saved.user2Id, 'bob');
  });
  test(`${uid} can merge unchanged participant IDs`, async () => {
    await assertSucceeds(setDoc(match(uid), { user1Id: 'alice', user2Id: 'bob', lastMessage: 'Photo', lastMessageTime: serverTimestamp() }, { merge: true }));
  });
  test(`${uid} can unmatch`, async () => { await assertSucceeds(deleteDoc(match(uid))); });
}
for (const uid of [null, 'outsider', 'moderator']) {
  test(`${uid || 'anonymous'} cannot update private match summary`, async () => {
    await assertFails(updateDoc(match(uid), { lastMessage: 'Forged' }));
  });
}
