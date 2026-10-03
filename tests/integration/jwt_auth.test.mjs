import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { 
  registerUser, 
  loginUser, 
  refreshUserToken, 
  comparePassword, 
  hashPassword,
  usersStore 
} from '../../apps/api/src/services/authService.js';

describe('Standard JWT, bcryptjs & Helmet Authentication Integration', () => {
  test('hashes password using bcryptjs and successfully verifies match', async () => {
    const plain = 'mySecurePassword2026!';
    const hash = await hashPassword(plain);

    assert.ok(hash.startsWith('$2'), 'Must be a valid bcrypt hash');
    const isMatch = await comparePassword(plain, hash);
    assert.strictEqual(isMatch, true);

    const isBadMatch = await comparePassword('wrongPassword', hash);
    assert.strictEqual(isBadMatch, false);
  });

  test('default seeded admin user logs in with bcrypt credentials and gets valid JWT', async () => {
    const result = await loginUser({
      email: 'admin@growprospect.local',
      password: 'admin123'
    });

    assert.strictEqual(result.user.email, 'admin@growprospect.local');
    assert.strictEqual(result.user.role, 'admin');
    assert.ok(result.accessToken, 'Must return JWT access token');
    assert.ok(result.refreshToken, 'Must return JWT refresh token');
    assert.strictEqual(result.tokenType, 'Bearer');
  });

  test('rejects login with wrong password', async () => {
    await assert.rejects(
      async () => {
        await loginUser({
          email: 'admin@growprospect.local',
          password: 'wrongPassword999'
        });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 401);
        assert.strictEqual(err.message, 'Invalid email or password');
        return true;
      }
    );
  });

  test('registers a new user with bcrypt hash and issues token pair', async () => {
    const newEmail = `user_${Date.now()}@growprospect.local`;
    const result = await registerUser({
      name: 'Sarah Connor',
      email: newEmail,
      password: 'securePass123!',
      role: 'manager',
      orgName: 'Cyberdyne Systems'
    });

    assert.strictEqual(result.user.name, 'Sarah Connor');
    assert.strictEqual(result.user.role, 'manager');
    assert.ok(result.accessToken);
    assert.ok(result.refreshToken);

    // Verify stored user has bcrypt hash
    const stored = usersStore.find((u) => u.email === newEmail);
    assert.ok(stored.password_hash.startsWith('$2'));
  });

  test('refreshes access token with valid refresh token', async () => {
    const loginRes = await loginUser({
      email: 'admin@growprospect.local',
      password: 'admin123'
    });

    const refreshRes = await refreshUserToken(loginRes.refreshToken);
    assert.ok(refreshRes.accessToken);
    assert.strictEqual(refreshRes.user.email, 'admin@growprospect.local');
  });
});
