export class Token {
  access_token: string;
  refresh_token: string;
  token_type: string;

  static load(): Token {
    return new Token({
      access_token: localStorage.getItem('access_token'),
      refresh_token: localStorage.getItem('refresh_token'),
      token_type: localStorage.getItem('token_type')
    });
  }

  constructor (hash?: any) {
    if (hash) {
      this.access_token = hash.access_token;
      this.refresh_token = hash.refresh_token;
      if (hash.token_type === 'bearer') {
        this.token_type = 'Bearer';
      } else {
        this.token_type = hash.token_type;
      }
    }
  }

  save():void {
    localStorage.setItem('access_token', this.access_token);
    localStorage.setItem('refresh_token', this.refresh_token);
    localStorage.setItem('token_type', this.token_type);
  }
}
