export class Token {
  access_token: string;
  refresh_token: string;
  token_type: string;

  constructor (hash) {
    this.access_token = hash.access_token;
    this.refresh_token = hash.refresh_token;
    this.token_type = hash.token_type;
  }

  save() {
    localStorage.setItem('access_token', this.access_token);
    localStorage.setItem('refresh_token', this.refresh_token);
    localStorage.setItem('token_type', this.token_type);
  }
}
