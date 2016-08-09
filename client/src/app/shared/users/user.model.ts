export class User {
  id: string;
  username: string;
  role: string;

  constructor(hash: { id: string, username: string, role: string }) {
    this.id = hash.id;
    this.username = hash.username;
    this.role = hash.role;
  }

  isAdmin() {
    return this.role === 'admin';
  }
}
