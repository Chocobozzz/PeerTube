import { Token } from './token';

export class User {
  username: string;
  token: Token;

  constructor (username: string, hash_token: any) {
    this.username = username;
    this.token = new Token(hash_token);
  }

  static load(): User {
    return new User(localStorage.getItem('username'), Token.load());
  }

  save(): void {
    localStorage.setItem('username', this.username);
    this.token.save();
  }
}
