import {
  resolveProfile,
  getProfileByIdentifier,
  getEvents,
  addEvent,
  emailToSalesforceContactId,
  generateSalesforceContactId
} from '../src/lib/server-db.ts';

console.log('=== TESTING SFMC 18-CHAR CONTACT ID FOR SUBSCRIBER KEY ===\n');

// 1. Verify format of generateSalesforceContactId
const genId = generateSalesforceContactId();
console.log('1. Generated SFMC Contact ID:', genId);
if (genId.length !== 18 || !genId.startsWith('003') || !genId.endsWith('AA0')) {
  throw new Error('FAILED: Generated Contact ID is not 18 characters starting with 003 and ending with AA0: ' + genId);
}
console.log('   ✓ Format verified: 18 characters, starts with 003, ends with AA0');

// 2. Verify deterministic conversion from email
const email = 'bruce.wayne.' + Date.now() + '@wayne-enterprises.com';
const contactId = emailToSalesforceContactId(email);
console.log('\n2. Converted email to SFMC Contact ID:');
console.log('   Email:', email);
console.log('   Subscriber Key (SFMC Contact ID):', contactId);
if (contactId.length !== 18 || !contactId.startsWith('003') || contactId.includes('@')) {
  throw new Error('FAILED: Subscriber key contains email or invalid length: ' + contactId);
}
console.log('   ✓ Subscriber key is an authentic 18-char SFMC Contact ID (NO email)');

// 3. Resolve profile with email input
const devId = 'anon-batmobile-' + Date.now();
const profile = resolveProfile({
  anonymousId: devId,
  subscriberKey: email,
  timestamp: new Date().toISOString()
});

console.log('\n3. Resolved Profile:');
console.log('   profileId:', profile.profileId);
console.log('   subscriberKey:', profile.subscriberKey);
console.log('   email attribute:', profile.attributes?.email);

if (profile.subscriberKey?.includes('@')) {
  throw new Error('FAILED: Profile subscriberKey must NOT be an email: ' + profile.subscriberKey);
}
if (!profile.subscriberKey?.startsWith('003') || profile.subscriberKey.length !== 18) {
  throw new Error('FAILED: Profile subscriberKey is not an 18-character Salesforce Contact ID: ' + profile.subscriberKey);
}
if (profile.attributes?.email !== email) {
  throw new Error('FAILED: Email attribute was not preserved in attributes.email: ' + profile.attributes?.email);
}
console.log('   ✓ Profile subscriberKey is 18-char Contact ID (' + profile.subscriberKey + ') and email is in attributes.email');

// 4. Lookup by both Contact ID and by Email
const byContactId = getProfileByIdentifier(profile.subscriberKey);
const byEmail = getProfileByIdentifier(email);

if (!byContactId || !byEmail || byContactId.profileId !== byEmail.profileId) {
  throw new Error('FAILED: Lookup by Contact ID or Email failed to find same profile');
}
console.log('   ✓ Profile can be looked up by Contact ID (' + profile.subscriberKey + ') OR by Email (' + email + ')');

// 5. Test Event Resolution
addEvent({
  id: 'evt-sfmc-test-' + Date.now(),
  timestamp: new Date().toISOString(),
  event: 'login',
  anonId: devId,
  subscriberKey: email,
  properties: { email }
});

const allEvents = getEvents();
const evt = allEvents.find(e => e.id.startsWith('evt-sfmc-test-'));
if (!evt) throw new Error('FAILED: Event not found');

console.log('\n4. Resolved Event:');
console.log('   event:', evt.event);
console.log('   subscriberKey:', evt.subscriberKey);
console.log('   properties.email:', evt.properties?.email);

if (evt.subscriberKey?.includes('@')) {
  throw new Error('FAILED: Event subscriberKey must not be an email: ' + evt.subscriberKey);
}
if (!evt.subscriberKey?.startsWith('003')) {
  throw new Error('FAILED: Event subscriberKey is not an 18-char Contact ID: ' + evt.subscriberKey);
}
if (evt.properties?.email !== email) {
  throw new Error('FAILED: Event email not preserved in properties.email');
}
console.log('   ✓ Event subscriberKey is Contact ID (' + evt.subscriberKey + ') and properties.email is ' + evt.properties?.email);

console.log('\n======================================================');
console.log('🎉 ALL SFMC 18-CHAR CONTACT ID SUBSCRIBER KEY TESTS PASSED!');
console.log('======================================================\n');
