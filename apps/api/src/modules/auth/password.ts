import argon2 from "argon2";

export type PasswordHasher = {
  hashPassword(password: string): Promise<string>;
  verifyPassword(hash: string, password: string): Promise<boolean>;
};

export class Argon2PasswordHasher implements PasswordHasher {
  hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id
    });
  }

  verifyPassword(hash: string, password: string): Promise<boolean> {
    return argon2.verify(hash, password);
  }
}
