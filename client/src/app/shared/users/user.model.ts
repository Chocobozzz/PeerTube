import { User as UserServerModel, UserRole } from '../../../../../shared';

export class User implements UserServerModel {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  displayNSFW: boolean;
  createdAt: Date;

  constructor(hash: {
    id: number,
    username: string,
    email: string,
    role: UserRole,
    displayNSFW?: boolean,
    createdAt?: Date,
  }) {
    this.id = hash.id;
    this.username = hash.username;
    this.email = hash.email;
    this.role = hash.role;
    this.displayNSFW = hash.displayNSFW;

    if (hash.createdAt) {
      this.createdAt = hash.createdAt;
    }
  }

  isAdmin() {
    return this.role === 'admin';
  }
}
