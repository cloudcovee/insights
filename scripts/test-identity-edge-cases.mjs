import {
  getProfiles,
  resolveProfile,
  getProfileByIdentifier,
  getEvents,
  addEvent,
  cleanIdentifier,
  cleanAnonId
} from '../src/lib/server-db.ts';

console.log('=== STARTING ENTERPRISE IDENTITY EDGE CASES TEST ===\n');

// ---------------------------------------------------------------------------
// Edge Case 1: Shared Computer / Account Switching
// ---------------------------------------------------------------------------
console.log('Test 1: Shared Computer / Public Terminal (User A logs out, User B logs in)');
const sharedAnonId = 'shared-terminal-' + Date.now();
const userA = 'employee.alice.' + Date.now() + '@workplace.com';
const userB = 'employee.bob.' + Date.now() + '@workplace.com';

// User A logs in on shared terminal
const profA = resolveProfile({
  anonymousId: sharedAnonId,
  subscriberKey: userA,
  timestamp: new Date(Date.now() - 3600000).toISOString()
});
console.log('  User A profile created:', profA.profileId, profA.subscriberKey);

// User A logs out, User B logs in on the exact same shared terminal
const profB = resolveProfile({
  anonymousId: sharedAnonId,
  subscriberKey: userB,
  timestamp: new Date().toISOString()
});
console.log('  User B profile resolved:', profB.profileId, profB.subscriberKey);

// Verify User A was NOT deleted and User A's subscriberKey was NOT overwritten
const checkUserA = getProfileByIdentifier(userA);
const checkUserB = getProfileByIdentifier(userB);

if (!checkUserA) throw new Error('FAILED: User A was deleted when User B logged into the shared device!');
if (!checkUserB) throw new Error('FAILED: User B profile was not created/found!');
if (checkUserA.profileId === checkUserB.profileId) {
  throw new Error('FAILED: User A and User B merged into the same profile on a shared device!');
}
if (checkUserA.subscriberKey !== profA.subscriberKey) {
  throw new Error('FAILED: User A subscriberKey was corrupted!');
}
if (checkUserB.subscriberKey !== profB.subscriberKey) {
  throw new Error('FAILED: User B subscriberKey was corrupted!');
}
console.log('  ✓ PASS: Shared device handled safely. User A and User B maintain separate, uncorrupted profiles.\n');

// ---------------------------------------------------------------------------
// Edge Case 2: Post-Logout Event Auth State vs Customer Profile Continuity
// ---------------------------------------------------------------------------
console.log('Test 2: Post-Logout Anonymous Event Auth State');
const devId = 'd' + Date.now();
const loggedInUser = 'charlie.' + Date.now() + '@test.com';

const runId = Date.now();
const authEvtId = 'evt-edge-auth-' + runId;
const anonEvtId = 'evt-edge-post-logout-' + runId;

// Authenticated event
addEvent({
  id: authEvtId,
  timestamp: new Date(Date.now() - 1800000).toISOString(),
  event: 'login',
  anonId: devId,
  userId: loggedInUser,
  subscriberKey: loggedInUser,
  projectId: 'proj_edge'
});

// Post-logout anonymous event on same device (simulating insight.reset())
addEvent({
  id: anonEvtId,
  timestamp: new Date().toISOString(),
  event: 'page_view',
  path: '/pricing',
  anonId: devId,
  userId: null,
  subscriberKey: null,
  projectId: 'proj_edge'
});

const events = getEvents();
const authEvt = events.find(e => e.id === authEvtId);
const anonEvt = events.find(e => e.id === anonEvtId);

if (!authEvt || !anonEvt) throw new Error('FAILED: Edge test events not found in getEvents()');

// Check that authEvt reflects logged in state
if (!authEvt.userId) {
  throw new Error('FAILED: Authenticated event did not retain userId ' + loggedInUser);
}

// Check that post-logout anonEvt has no userId (so UI displays Anonymous)
if (anonEvt.userId) {
  throw new Error('FAILED: Post-logout anonymous event was falsely marked with userId: ' + anonEvt.userId);
}

// Check that both events still link to the same unified customer profileId!
if (authEvt.profileId !== anonEvt.profileId) {
  throw new Error('FAILED: Post-logout event lost connection to customer profileId!');
}
console.log('  ✓ PASS: Authenticated event has userId=' + authEvt.userId + ' (Logged In)');
console.log('  ✓ PASS: Post-logout event has userId=undefined (Anonymous)');
console.log('  ✓ PASS: Both share the same unified profileId=' + authEvt.profileId + '\n');

// ---------------------------------------------------------------------------
// Edge Case 3: Case-Insensitivity of Subscriber Keys
// ---------------------------------------------------------------------------
console.log('Test 3: Case-Insensitive Identifiers');
const mixedEmail = 'Daenerys.Targaryen.' + Date.now() + '@Westeros.GOV';
const lowerEmail = mixedEmail.toLowerCase();
const upperEmail = mixedEmail.toUpperCase();

const pMixed = resolveProfile({
  anonymousId: 'anon-dany-' + Date.now(),
  subscriberKey: mixedEmail
});

const lookupLower = getProfileByIdentifier(lowerEmail);
const lookupUpper = getProfileByIdentifier(upperEmail);

if (!lookupLower || !lookupUpper || lookupLower.profileId !== pMixed.profileId || lookupUpper.profileId !== pMixed.profileId) {
  throw new Error('FAILED: Case-insensitive lookup failed');
}
console.log('  ✓ PASS: Mixed, lower, and upper case subscriber keys resolve to the same profile\n');

// ---------------------------------------------------------------------------
// Edge Case 4: Malformed / Garbage Identifiers
// ---------------------------------------------------------------------------
console.log('Test 4: Garbage / Missing / Malformed Identifiers');
if (cleanIdentifier('   ') !== undefined) throw new Error('cleanIdentifier failed on spaces');
if (cleanIdentifier('unknown') !== undefined) throw new Error('cleanIdentifier failed on unknown');
if (cleanIdentifier('undefined') !== undefined) throw new Error('cleanIdentifier failed on undefined');
if (cleanIdentifier('null') !== undefined) throw new Error('cleanIdentifier failed on null');
if (cleanIdentifier('[object Object]') !== undefined) throw new Error('cleanIdentifier failed on [object Object]');
if (cleanIdentifier('valid-id-123') !== 'valid-id-123') throw new Error('cleanIdentifier failed on valid id');

const transientProfile = resolveProfile({
  anonymousId: 'unknown',
  subscriberKey: '   '
});
if (!transientProfile.profileId.startsWith('anon_') && !transientProfile.profileId.startsWith('prof_anon_')) {
  throw new Error('FAILED: Garbage identifiers should return transient profile');
}
console.log('  ✓ PASS: Garbage identifiers safely sanitized and prevented from polluting profile graph\n');

// ---------------------------------------------------------------------------
// Edge Case 5: Deduplication of Anonymous IDs
// ---------------------------------------------------------------------------
console.log('Test 5: Deduplication of Anonymous IDs in profile.anonymousIds');
const dedupUser = 'dedup.user.' + Date.now() + '@test.com';
const dedupAnon = 'd' + Date.now();

resolveProfile({ anonymousId: dedupAnon, subscriberKey: dedupUser });
resolveProfile({ anonymousId: dedupAnon, subscriberKey: dedupUser });
resolveProfile({ anonymousId: dedupAnon.toUpperCase(), subscriberKey: dedupUser });

const dedupProfile = getProfileByIdentifier(dedupUser);
if (!dedupProfile) throw new Error('Deduplication profile not found');
const count = dedupProfile.anonymousIds.filter(id => id.toLowerCase() === (cleanAnonId(dedupAnon)?.toLowerCase() || dedupAnon.toLowerCase())).length;
if (count !== 1) {
  throw new Error('FAILED: Anonymous ID was duplicated in profile: ' + JSON.stringify(dedupProfile.anonymousIds));
}
console.log('  ✓ PASS: anonymousIds array is strictly deduplicated\n');

// ---------------------------------------------------------------------------
// Edge Case 6: Special Characters in SubscriberKey
// ---------------------------------------------------------------------------
console.log('Test 6: Special Characters in SubscriberKey');
const specialKey = 'dr.watson+emergency#99_test$special@221b-baker.co.uk';
const profSpecial = resolveProfile({
  anonymousId: 'anon-watson-' + Date.now(),
  subscriberKey: specialKey
});

const foundSpecial = getProfileByIdentifier(specialKey);
if (!foundSpecial || foundSpecial.profileId !== profSpecial.profileId) {
  throw new Error('FAILED: Special character subscriberKey lookup failed');
}
console.log('  ✓ PASS: Subscriber key with +, #, $, ., -, _ resolved accurately\n');

console.log('====================================================');
console.log('🎉 ALL ENTERPRISE IDENTITY EDGE CASES PASSED! 🎉');
console.log('====================================================\n');
