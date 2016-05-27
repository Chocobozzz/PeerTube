import { Token } from './token.model';

export class User {
  username: string;
  token: Token;

  static load() {
    return new User(localStorage.getItem('username'), Token.load());
  }

  constructor(username: string, hash_token: any) {
    this.username = username;
    this.token = new Token(hash_token);
  }

  save() {
    localStorage.setItem('username', this.username);
    this.token.save();
  }
}
