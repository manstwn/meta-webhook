const assert = require('assert');
const { isPhoneAllowed } = require('../src/controllers/webhookController');
const storage = require('../src/utils/storage');

console.log('Running phone filter tests...');

// 1. Blank/Empty filter allows all
assert.strictEqual(isPhoneAllowed('6281234567890', ''), true, 'Blank filter should allow any number');
assert.strictEqual(isPhoneAllowed('6281234567890', null), true, 'Null filter should allow any number');
assert.strictEqual(isPhoneAllowed('14155552671', '   '), true, 'Whitespace filter should allow any number');

// 2. Exact match
assert.strictEqual(isPhoneAllowed('6281234567890', '6281234567890'), true, 'Exact number should match');
assert.strictEqual(isPhoneAllowed('6289999999999', '6281234567890'), false, 'Different number should be rejected');

// 3. International formatting & symbols in filter
assert.strictEqual(isPhoneAllowed('14155552671', '+1 (415) 555-2671'), true, 'Formatted US number should match clean digits');
assert.strictEqual(isPhoneAllowed('44712345678', '+44-712-345-678'), true, 'Formatted UK number should match');

// 4. Indonesian local format normalization (08... -> 628...)
assert.strictEqual(isPhoneAllowed('6281234567890', '081234567890'), true, '08... format in filter should match 628... sender');
assert.strictEqual(isPhoneAllowed('6281234567890', '0812*'), true, '0812* prefix should match 62812... sender');

// 5. Wildcard prefix (62812*, 62*, 1*)
assert.strictEqual(isPhoneAllowed('628129999999', '62812*'), true, 'Prefix wildcard should match');
assert.strictEqual(isPhoneAllowed('628999999999', '62812*'), false, 'Non-matching prefix should be rejected');
assert.strictEqual(isPhoneAllowed('628123456789', '62*'), true, '62* prefix should match any Indonesian number');
assert.strictEqual(isPhoneAllowed('14155552671', '62*'), false, '62* prefix should reject US number');

// 6. Digit mask (X / x)
assert.strictEqual(isPhoneAllowed('62123456', '62XXXXXX'), true, '62XXXXXX should match 62 followed by 6 digits');
assert.strictEqual(isPhoneAllowed('6212345', '62XXXXXX'), false, '62XXXXXX should reject 5 digits');
assert.strictEqual(isPhoneAllowed('621234567', '62XXXXXX'), false, '62XXXXXX should reject 7 digits');

// 7. Multi-rule lists (comma, semicolon, newline separated)
const multiFilter = '6281111111111, 6282222222222; 6283333333333\n1415*';
assert.strictEqual(isPhoneAllowed('6281111111111', multiFilter), true, 'First rule in multi-list should match');
assert.strictEqual(isPhoneAllowed('6282222222222', multiFilter), true, 'Second rule in multi-list should match');
assert.strictEqual(isPhoneAllowed('14159998877', multiFilter), true, 'Wildcard rule in multi-list should match');
assert.strictEqual(isPhoneAllowed('6289999999999', multiFilter), false, 'Unlisted number in multi-list should be rejected');

// 8. Non-phone identifiers (e.g. system events)
assert.strictEqual(isPhoneAllowed('account_alerts', '62812*'), false, 'System event identifier should not match phone filter');

// 9. Storage integrity for phoneFilter
const testDomain = storage.saveDomain({
  url: 'https://test-filter-domain.com/webhook',
  phoneFilter: '6281234567890, 62812*',
  notes: 'Unit test domain',
  enabled: true
});
assert.strictEqual(testDomain.phoneFilter, '6281234567890, 62812*', 'Storage should retain phoneFilter');
storage.deleteDomain(testDomain.id);

console.log('All phone filter tests passed successfully!');
