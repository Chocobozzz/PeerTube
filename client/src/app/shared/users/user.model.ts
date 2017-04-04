export class User {
  id: number;
  username: string;
  role: string;
  displayNSFW: boolean;
  createdAt: Date;

  constructor(hash: {
    id: number,
    username: string,
    role: string,
    displayNSFW?: boolean,
    createdAt?: Date,
  }) {
    this.id = hash.id;
    this.username = hash.username;
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
