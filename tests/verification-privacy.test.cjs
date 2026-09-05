// Local Firestore emulator only. Install firebase@11.10.0 and
// @firebase/rules-unit-testing@4.0.1 externally; set NODE_PATH to that node_modules.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, getDoc, getDocs, collection, setDoc, updateDoc, deleteDoc, serverTimestamp, deleteField } = require('node:module').createRequire(require.resolve('@firebase/rules-unit-testing'))('firebase/firestore');
const host = process.env.FIRESTORE_EMULATOR_HOST;
assert.match(host || '', /^(127\.0\.0\.1|localhost):\d+$/, 'Refuse non-local/missing emulator');
const root = path.resolve(__dirname, '..');
const rulesPath = fs.existsSync(path.join(root, 'firebase/firestore.rules'))
  ? path.join(root, 'firebase/firestore.rules') : path.join(root, 'firestore.rules');
const projectId = 'demo-filwest-privacy-' + (rulesPath.includes('/firebase/') ? 'app' : 'site');
let env;
const payload = (uid = 'owner') => ({ userId: uid, method: 'id', selfieUrl: 'https://example.invalid/selfie', idFrontUrl: 'https://example.invalid/id-front?token=synthetic', idBackUrl: 'https://example.invalid/id-back', status: 'pending', verified: false, createdAt: serverTimestamp() });
const db = (uid, claims) => uid ? env.authenticatedContext(uid, claims).firestore() : env.unauthenticatedContext().firestore();
const ref = (uid, target = 'owner', claims) => doc(db(uid, claims), 'verifications', target);
before(async () => {
  const [hostname, port] = host.split(':');
  env = await initializeTestEnvironment({ projectId, firestore: { host: hostname, port: Number(port), rules: fs.readFileSync(rulesPath, 'utf8') } });
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'verifications', 'owner'), payload());
    await setDoc(doc(context.firestore(), 'admins', 'reviewer'), { enabled: true });
  });
});
after(async () => { if (env) await env.cleanup(); });

test('cross-user direct read cannot expose identity download URLs', async () => {
  await assertFails(getDoc(ref('stranger')));
});
test('owner can read own private verification', async () => {
  const snap = await assertSucceeds(getDoc(ref('owner')));
  assert.equal(snap.data().idFrontUrl, payload().idFrontUrl);
});
test('allowlisted admin can read verification and review queue', async () => {
  await assertSucceeds(getDoc(ref('reviewer')));
  await assertSucceeds(getDocs(collection(db('reviewer'), 'verifications')));
});
test('anonymous reads denied', async () => { await assertFails(getDoc(ref(null))); });
test('ordinary member cannot list private verifications', async () => {
  await assertFails(getDocs(collection(db('owner'), 'verifications')));
});
test('admin custom claim alone is not the admin allowlist contract', async () => {
  await assertFails(getDoc(ref('stranger', 'owner', { admin: true })));
});
test('member cannot grant itself admin allowlist membership', async () => {
  await assertFails(setDoc(doc(db('stranger'), 'admins', 'stranger'), {}));
});

test('owner can create pending submission using website payload', async () => {
  await assertSucceeds(setDoc(ref('new-owner', 'new-owner'), payload('new-owner')));
});
test('owner can create without optional verified flag', async () => {
  const data = payload('new-owner'); delete data.verified;
  await assertSucceeds(setDoc(ref('new-owner', 'new-owner'), data));
});
test('owner can merge resubmission without touching verified flag', async () => {
  const data = payload(); delete data.verified;
  data.selfieUrl = 'https://example.invalid/replacement';
  await assertSucceeds(setDoc(ref('owner'), data, { merge: true }));
});
for (const [name, change] of Object.entries({ approvedStatus: { status: 'approved' }, rejectedStatus: { status: 'rejected' }, forgedOwner: { userId: 'victim' }, forgedReviewer: { reviewedBy: 'reviewer' }, selfApproval: { verified: true } })) {
  test(`create rejects ${name}`, async () => {
    await assertFails(setDoc(ref('new-owner', 'new-owner'), { ...payload('new-owner'), ...change }));
  });
  test(`update rejects ${name}`, async () => {
    await assertFails(updateDoc(ref('owner'), change));
  });
}
test('owner cannot delete verified field', async () => {
  await assertFails(updateDoc(ref('owner'), { verified: deleteField() }));
});
test('owner cannot replace already-approved identity evidence', async () => {
  await env.withSecurityRulesDisabled(context => updateDoc(doc(context.firestore(), 'verifications', 'owner'), { verified: true, status: 'approved' }));
  const data = payload(); delete data.verified;
  await assertFails(setDoc(ref('owner'), data, { merge: true }));
});
test('rejected member can resubmit evidence for review', async () => {
  await env.withSecurityRulesDisabled(context => updateDoc(doc(context.firestore(), 'verifications', 'owner'), { verified: false, status: 'rejected', reviewedBy: 'reviewer' }));
  const data = payload(); delete data.verified;
  await assertSucceeds(setDoc(ref('owner'), data, { merge: true }));
});
for (const uid of [null, 'stranger', 'reviewer']) {
  test(`${uid || 'anonymous'} cannot create or alter another member verification`, async () => {
    await assertFails(setDoc(ref(uid, 'absent'), payload('absent')));
    await assertFails(updateDoc(ref(uid), { selfieUrl: 'https://example.invalid/changed' }));
    await assertFails(updateDoc(ref(uid), { verified: true }));
  });
}
test('owner and admin cannot delete verification via client', async () => {
  await assertFails(deleteDoc(ref('owner')));
  await assertFails(deleteDoc(ref('reviewer')));
});
