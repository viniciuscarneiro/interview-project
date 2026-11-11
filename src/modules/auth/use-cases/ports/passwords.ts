export interface Passwords {
  hash(password: string): Promise<string>;
  /** Null performs equivalent password work but always rejects. Invalid stored hashes throw. */
  verify(password: string, hash: string | null): Promise<boolean>;
}
