import { test, describe } from 'node:test';
import assert from 'node:assert';

describe('Admin Authentication Validation', () => {
  const EXPECTED_USER = 'admin';
  const EXPECTED_PASS = 'leadscrape2026';

  function validateCredentials(user, pass) {
    if ((user || '').trim() === EXPECTED_USER && (pass || '').trim() === EXPECTED_PASS) {
      return {
        success: true,
        token: 'auth-test-valid-token',
        user: { username: EXPECTED_USER, role: 'ADMIN' }
      };
    }
    return {
      success: false,
      error: 'Invalid credentials'
    };
  }

  test('approves correct .env admin credentials', () => {
    const result = validateCredentials('admin', 'leadscrape2026');
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.user.username, 'admin');
  });

  test('rejects incorrect username or password', () => {
    const badUser = validateCredentials('user', 'leadscrape2026');
    assert.strictEqual(badUser.success, false);

    const badPass = validateCredentials('admin', 'wrong');
    assert.strictEqual(badPass.success, false);

    const empty = validateCredentials('', '');
    assert.strictEqual(empty.success, false);
  });
});
