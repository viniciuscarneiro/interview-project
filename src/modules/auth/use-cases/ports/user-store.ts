import type { User } from '../../model/user.js';
export interface UserStore {
  /** Returns null when absent. Unexpected storage failures propagate. */
  findByEmail(email: string): Promise<User | null>;
}
