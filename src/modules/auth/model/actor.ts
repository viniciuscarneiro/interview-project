export type Role = 'ADMIN' | 'BASIC';
export interface Actor {
  readonly id: string;
  readonly role: Role;
}
