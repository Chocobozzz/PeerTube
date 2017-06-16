// Do not use the barrel (dependency loop)
import { UserRole } from '../../../../../shared/models/user.model'
import { User } from '../../shared/users/user.model';

export class AuthUser extends User {
  private static KEYS = {
    ID: 'id',
    ROLE: 'role',
    EMAIL: 'email',
    USERNAME: 'username',
    DISPLAY_NSFW: 'display_nsfw'
  };

  tokens: Tokens;

  static load() {
    const usernameLocalStorage = localStorage.getItem(this.KEYS.USERNAME);
    if (usernameLocalStorage) {
      return new AuthUser(
        {
          id: parseInt(localStorage.getItem(this.KEYS.ID)),
          username: localStorage.getItem(this.KEYS.USERNAME),
          email: localStorage.getItem(this.KEYS.EMAIL),
          role: localStorage.getItem(this.KEYS.ROLE) as UserRole,
          displayNSFW: localStorage.getItem(this.KEYS.DISPLAY_NSFW) === 'true'
        },
        Tokens.load()
      );
    }

    return null;
  }

  static flush() {
    localStorage.removeItem(this.KEYS.USERNAME);
    localStorage.removeItem(this.KEYS.ID);
    localStorage.removeItem(this.KEYS.ROLE);
    localStorage.removeItem(this.KEYS.DISPLAY_NSFW);
    Tokens.flush();
  }

  constructor(userHash: {
    id: number,
    username: string,
    role: UserRole,
    email: string,
    displayNSFW: boolean
  }, hashTokens: any) {
    super(userHash);
    this.tokens = new Tokens(hashTokens);
  }

  getAccessToken() {
    return this.tokens.access_token;
  }

  getRefreshToken() {
    return this.tokens.refresh_token;
  }

  getTokenType() {
    return this.tokens.token_type;
  }

  refreshTokens(access_token: string, refresh_token: string) {
    this.tokens.access_token = access_token;
    this.tokens.refresh_token = refresh_token;
  }

  save() {
    localStorage.setItem(AuthUser.KEYS.ID, this.id.toString());
    localStorage.setItem(AuthUser.KEYS.USERNAME, this.username);
    localStorage.setItem(AuthUser.KEYS.ROLE, this.role);
    localStorage.setItem(AuthUser.KEYS.DISPLAY_NSFW, JSON.stringify(this.displayNSFW));
    this.tokens.save();
  }
}

// Private class only used by User
class Tokens {
  private static KEYS = {
    ACCESS_TOKEN: 'access_token',
    REFRESH_TOKEN: 'refresh_token',
    TOKEN_TYPE: 'token_type',
  };

  access_token: string;
  refresh_token: string;
  token_type: string;

  static load() {
    const accessTokenLocalStorage = localStorage.getItem(this.KEYS.ACCESS_TOKEN);
    const refreshTokenLocalStorage = localStorage.getItem(this.KEYS.REFRESH_TOKEN);
    const tokenTypeLocalStorage = localStorage.getItem(this.KEYS.TOKEN_TYPE);

    if (accessTokenLocalStorage && refreshTokenLocalStorage && tokenTypeLocalStorage) {
      return new Tokens({
        access_token: accessTokenLocalStorage,
        refresh_token: refreshTokenLocalStorage,
        token_type: tokenTypeLocalStorage
      });
    }

    return null;
  }

  static flush() {
    localStorage.removeItem(this.KEYS.ACCESS_TOKEN);
    localStorage.removeItem(this.KEYS.REFRESH_TOKEN);
    localStorage.removeItem(this.KEYS.TOKEN_TYPE);
  }

  constructor(hash?: any) {
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

  save() {
    localStorage.setItem('access_token', this.access_token);
    localStorage.setItem('refresh_token', this.refresh_token);
    localStorage.setItem('token_type', this.token_type);
  }
}
