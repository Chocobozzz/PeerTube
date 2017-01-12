export class User {
  id: number;
  username: string;
  role: string;
  createdAt: Date;

  constructor(hash: { id: number, username: string, role: string, createdAt?: Date }) {
    this.id = hash.id;
    this.username = hash.username;
    this.role = hash.role;

    if (hash.createdAt) {
      this.createdAt = hash.createdAt;
    }
  }

  isAdmin() {
    return this.role === 'admin';
  }
}
