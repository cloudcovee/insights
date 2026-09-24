import fs from 'fs';
import path from 'path';
import {
  getProfiles,
  resolveProfile,
  getProfileByIdentifier,
  getProfileEvents,
  getEvents,
  addEvent,
  writeProfiles,
} from '../src/lib/server-db.ts';

console.log('=== Starting Identity Resolution Test ===\n');

// 1. Test anonymous browsing on Device A
console.log('Scenario 1: Visitor browses anonymously on Device A');
const anonA = 'anon-browser-a-' + Date.now();
const profileA = resolveProfile({
  anonymousId: anonA,
  timestamp: new Date(Date.now() - 3600000).toISOString(),
  properties: { page: '/products/boots' }
});

console.log('  Profile created:');
console.log('    profileId:', profileA.profileId);
console.log('    anonymousIds:', profileA.anonymousIds);
console.log('    subscriberKey:', profileA.subscriberKey || '(none - anonymous)');

if (!profileA.profileId.startsWith('prof_') || !profileA.anonymousIds.includes(anonA)) {
  throw new Error('FAILED: Anonymous profile A not created properly');
}

// 2. Add an event for Device A
addEvent({
  id: 'evt-test-1',
  timestamp: new Date(Date.now() - 3600000).toISOString(),
  event: 'page_view',
  path: '/products/boots',
  anonId: anonA,
  userId: null,
  profileId: profileA.profileId,
  projectId: 'proj_test'
});
console.log('  ✓ Event 1 added for Device A');

// 3. Test anonymous browsing on Device B (e.g. mobile phone)
console.log('\nScenario 2: Visitor browses anonymously on Device B (mobile phone)');
const anonB = 'anon-mobile-b-' + Date.now();
const profileB = resolveProfile({
  anonymousId: anonB,
  timestamp: new Date(Date.now() - 1800000).toISOString(),
  properties: { page: '/products/jackets' }
});

console.log('  Profile created for Device B:');
console.log('    profileId:', profileB.profileId);
console.log('    anonymousIds:', profileB.anonymousIds);

if (profileA.profileId === profileB.profileId) {
  throw new Error('FAILED: Two distinct anonymous devices should start with separate profiles before login');
}

addEvent({
  id: 'evt-test-2',
  timestamp: new Date(Date.now() - 1800000).toISOString(),
  event: 'page_view',
  path: '/products/jackets',
  anonId: anonB,
  userId: null,
  profileId: profileB.profileId,
  projectId: 'proj_test'
});
console.log('  ✓ Event 2 added for Device B');

// 4. Visitor logs in on Device A with subscriberKey
const subKey = 'alex.cross@enterprise.com';
console.log(`\nScenario 3: Visitor logs in on Device A as "${subKey}"`);
const resolvedLoginA = resolveProfile({
  anonymousId: anonA,
  subscriberKey: subKey,
  timestamp: new Date(Date.now() - 900000).toISOString(),
  properties: { action: 'login' }
});

console.log('  Profile after Device A login:');
console.log('    profileId:', resolvedLoginA.profileId);
console.log('    subscriberKey:', resolvedLoginA.subscriberKey);
console.log('    anonymousIds:', resolvedLoginA.anonymousIds);

if (resolvedLoginA.subscriberKey !== subKey || !resolvedLoginA.anonymousIds.includes(anonA)) {
  throw new Error('FAILED: Profile did not associate subscriberKey with Device A');
}

addEvent({
  id: 'evt-test-3',
  timestamp: new Date(Date.now() - 900000).toISOString(),
  event: 'login',
  anonId: anonA,
  userId: subKey,
  subscriberKey: subKey,
  profileId: resolvedLoginA.profileId,
  projectId: 'proj_test'
});
console.log('  ✓ Event 3 (login) added for Device A');

// 5. Visitor logs in on Device B with the same subscriberKey
console.log(`\nScenario 4: Visitor now logs in on Device B as "${subKey}"`);
const resolvedLoginB = resolveProfile({
  anonymousId: anonB,
  subscriberKey: subKey,
  timestamp: new Date().toISOString(),
  properties: { action: 'login_device_b' }
});

console.log('  Merged Profile across all devices:');
console.log('    profileId:', resolvedLoginB.profileId);
console.log('    subscriberKey:', resolvedLoginB.subscriberKey);
console.log('    anonymousIds:', resolvedLoginB.anonymousIds);

if (resolvedLoginB.profileId !== resolvedLoginA.profileId) {
  throw new Error('FAILED: Profile IDs did not unify across devices!');
}
if (!resolvedLoginB.anonymousIds.includes(anonA) || !resolvedLoginB.anonymousIds.includes(anonB)) {
  throw new Error('FAILED: Unified profile does not contain both anonymous device IDs!');
}
console.log('  ✓ Multi-device identity merge verified: Both anonA and anonB mapped to single profileId');

addEvent({
  id: 'evt-test-4',
  timestamp: new Date().toISOString(),
  event: 'purchase',
  anonId: anonB,
  userId: subKey,
  subscriberKey: subKey,
  profileId: resolvedLoginB.profileId,
  projectId: 'proj_test'
});
console.log('  ✓ Event 4 (purchase) added for Device B');

// 6. Verify Dynamic Historical Event Resolution
console.log('\nScenario 5: Dynamic Historical Event Resolution');
const allEvents = getEvents();
const alexEvents = allEvents.filter(e => e.id.startsWith('evt-test-'));

console.log(`  Found ${alexEvents.length} test events.`);
for (const e of alexEvents) {
  console.log(`    Event ${e.id} [${e.event}]: profileId=${e.profileId}, subscriberKey=${e.subscriberKey}, anonId=${e.anonId}`);
  if (e.profileId !== resolvedLoginB.profileId) {
    throw new Error(`FAILED: Event ${e.id} was not dynamically resolved to unified profileId ${resolvedLoginB.profileId}`);
  }
}
console.log('  ✓ All 4 events (including pre-login anonymous events from both devices) dynamically resolve to Sarah/Alex\'s profileId!');

// 7. Verify Lookup by any identifier
console.log('\nScenario 6: Querying Profile Graph by various identifiers');
const bySubKey = getProfileByIdentifier(subKey);
const byAnonA = getProfileByIdentifier(anonA);
const byAnonB = getProfileByIdentifier(anonB);
const byProfId = getProfileByIdentifier(resolvedLoginB.profileId);

if (!bySubKey || !byAnonA || !byAnonB || !byProfId) {
  throw new Error('FAILED: Identifier lookup failed for one or more keys');
}
if (bySubKey.profileId !== byAnonA.profileId || byAnonA.profileId !== byAnonB.profileId) {
  throw new Error('FAILED: Identifier lookup returned inconsistent profile IDs');
}
console.log('  ✓ Lookup by subscriberKey, anonId (Dev A), anonId (Dev B), and profileId all return the exact same Unified Profile!');

console.log('\n========================================');
console.log('🎉 ALL IDENTITY RESOLUTION TESTS PASSED! 🎉');
console.log('========================================\n');
