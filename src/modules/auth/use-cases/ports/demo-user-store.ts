import type { User } from '../../model/user.js';
export interface DemoUserStore {
  /** Atomically create missing users; never overwrite existing rows. Adapt each stored
   * result into a User and invoke validateIdentity synchronously before committing.
   * Callback errors roll back the entire batch. Repeats preserve credentials and IDs.
   * Unexpected storage failures propagate; no implicit retries. */
  provision(
    users: readonly User[],
    validateIdentity: (requested: User, persisted: User) => void,
  ): Promise<void>;
}
