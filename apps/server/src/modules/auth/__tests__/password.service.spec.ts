import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { PasswordService } from '../password.service';

describe('PasswordService (Argon2id Hashing)', () => {
  const passwordService = new PasswordService();

  it('should hash a password with Argon2id algorithm', async () => {
    const rawPassword = 'StrongPassword@2026!';
    const hash = await passwordService.hash(rawPassword);

    assert.ok(hash);
    assert.strictEqual(typeof hash, 'string');
    assert.ok(hash.startsWith('$argon2id$'), 'Hash should use Argon2id format');
  });

  it('should successfully verify a correct password', async () => {
    const rawPassword = 'MySecretPassword123#';
    const hash = await passwordService.hash(rawPassword);

    const isValid = await passwordService.verify(hash, rawPassword);
    assert.strictEqual(isValid, true, 'Verification should return true for correct password');
  });

  it('should fail verification for an incorrect password', async () => {
    const rawPassword = 'CorrectPassword';
    const wrongPassword = 'WrongPassword';
    const hash = await passwordService.hash(rawPassword);

    const isValid = await passwordService.verify(hash, wrongPassword);
    assert.strictEqual(isValid, false, 'Verification should return false for wrong password');
  });

  it('should handle invalid or empty inputs gracefully without throwing', async () => {
    assert.strictEqual(await passwordService.verify('', 'password'), false);
    assert.strictEqual(await passwordService.verify('invalid_hash_string', 'password'), false);
    assert.strictEqual(
      await passwordService.verify('$argon2id$v=19$m=65536,t=3,p=4$dummy', ''),
      false,
    );
  });

  it('should reject hashing empty password string', async () => {
    await assert.rejects(async () => {
      await passwordService.hash('');
    }, /Password must be a non-empty string/);
  });
});
