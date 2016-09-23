export class User {
  id: string;
  username: string;
  role: string;
  createdDate: Date;

  constructor(hash: { id: string, username: string, role: string, createdDate: Date }) {
    this.id = hash.id;
    this.username = hash.username;
    this.role = hash.role;
    this.createdDate = hash.createdDate;
  }

  isAdmin() {
    return this.role === 'admin';
  }
}
