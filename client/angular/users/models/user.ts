import { Token } from './token';

export class User {
  username: string;
  token: Token;

  static load(): User {
    return new User(localStorage.getItem('username'), Token.load());
  }

  constructor (username: string, hash_token: any) {
    this.username = username;
    this.token = new Token(hash_token);
  }

  save(): void {
    localStorage.setItem('username', this.username);
    this.token.save();
  }
}
