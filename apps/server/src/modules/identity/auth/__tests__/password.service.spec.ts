import { expectReject } from '../../../../../test/test-assertions';
import { PasswordService } from '../password.service';

describe('PasswordService (Argon2id Hashing)', () => {
  const passwordService = new PasswordService();

  it('should hash a password with Argon2id algorithm', async () => {
    const rawPassword = 'StrongPassword@2026!';
    const hash = await passwordService.hash(rawPassword);

    expect(hash).toBeTruthy();
    expect(typeof hash).toBe('string');
    expect(hash.startsWith('$argon2id$')).toBeTruthy();
  });

  it('should successfully verify a correct password', async () => {
    const rawPassword = 'MySecretPassword123#';
    const hash = await passwordService.hash(rawPassword);

    const isValid = await passwordService.verify(hash, rawPassword);
    expect(isValid).toBe(true);
  });

  it('should fail verification for an incorrect password', async () => {
    const rawPassword = 'CorrectPassword';
    const wrongPassword = 'WrongPassword';
    const hash = await passwordService.hash(rawPassword);

    const isValid = await passwordService.verify(hash, wrongPassword);
    expect(isValid).toBe(false);
  });

  it('should handle invalid or empty inputs gracefully without throwing', async () => {
    expect(await passwordService.verify('', 'password')).toBe(false);
    expect(await passwordService.verify('invalid_hash_string', 'password')).toBe(false);
    expect(await passwordService.verify('$argon2id$v=19$m=65536,t=3,p=4$dummy', '')).toBe(false);
  });

  it('should reject hashing empty password string', async () => {
    await expectReject(async () => {
      await passwordService.hash('');
    }, /Password must be a non-empty string/);
  });
});
