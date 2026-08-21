import { Injectable, Logger } from '@nestjs/common';
import * as argon2 from 'argon2';

@Injectable()
export class PasswordService {
  private readonly logger = new Logger(PasswordService.name);

  // OWASP recommended Argon2id parameters
  private readonly hashingOptions: argon2.Options = {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB
    timeCost: 3,
    parallelism: 4,
  };

  /**
   * Hashes a plaintext password using Argon2id algorithm.
   * @param password Plaintext password
   * @returns Formatted Argon2id hash string
   */
  async hash(password: string): Promise<string> {
    if (!password || typeof password !== 'string') {
      throw new Error('Password must be a non-empty string');
    }
    return argon2.hash(password, this.hashingOptions);
  }

  /**
   * Verifies a plaintext password against a stored Argon2id hash.
   * @param hash Stored password hash
   * @param plain Candidate plaintext password
   * @returns True if password matches the hash, false otherwise
   */
  async verify(hash: string, plain: string): Promise<boolean> {
    if (!hash || !plain || typeof hash !== 'string' || typeof plain !== 'string') {
      return false;
    }
    try {
      return await argon2.verify(hash, plain);
    } catch (err) {
      this.logger.warn(`Password verification failed with error: ${(err as Error)?.message}`);
      return false;
    }
  }
}
