import { HttpStatusCode, OAuth2ErrorCode, UserRefreshToken } from '../../../../../shared/models'
import { objectToUrlEncoded, UserTokens } from '../../../root-helpers'
import { peertubeLocalStorage } from '../../../root-helpers/peertube-web-storage'

export class AuthHTTP {
  private readonly LOCAL_STORAGE_OAUTH_CLIENT_KEYS = {
    CLIENT_ID: 'client_id',
    CLIENT_SECRET: 'client_secret'
  }

  private userTokens: UserTokens

  private headers = new Headers()

  constructor () {
    this.userTokens = UserTokens.getUserTokens(peertubeLocalStorage)

    if (this.userTokens) this.setHeadersFromTokens()
  }

  fetch (url: string, { optionalAuth }: { optionalAuth: boolean }) {
    const refreshFetchOptions = optionalAuth
      ? { headers: this.headers }
      : {}

    return this.refreshFetch(url.toString(), refreshFetchOptions)
  }

  getHeaderTokenValue () {
    return `${this.userTokens.tokenType} ${this.userTokens.accessToken}`
  }

  isLoggedIn () {
    return !!this.userTokens
  }

  private refreshFetch (url: string, options?: RequestInit) {
    return fetch(url, options)
      .then((res: Response) => {
        if (res.status !== HttpStatusCode.UNAUTHORIZED_401) return res

        const refreshingTokenPromise = new Promise<void>((resolve, reject) => {
          const clientId: string = peertubeLocalStorage.getItem(this.LOCAL_STORAGE_OAUTH_CLIENT_KEYS.CLIENT_ID)
          const clientSecret: string = peertubeLocalStorage.getItem(this.LOCAL_STORAGE_OAUTH_CLIENT_KEYS.CLIENT_SECRET)

          const headers = new Headers()
          headers.set('Content-Type', 'application/x-www-form-urlencoded')

          const data = {
            refresh_token: this.userTokens.refreshToken,
            client_id: clientId,
            client_secret: clientSecret,
            response_type: 'code',
            grant_type: 'refresh_token'
          }

          fetch('/api/v1/users/token', {
            headers,
            method: 'POST',
            body: objectToUrlEncoded(data)
          }).then(res => {
            if (res.status === HttpStatusCode.UNAUTHORIZED_401) return undefined

            return res.json()
          }).then((obj: UserRefreshToken & { code?: OAuth2ErrorCode }) => {
            if (!obj || obj.code === OAuth2ErrorCode.INVALID_GRANT) {
              UserTokens.flushLocalStorage(peertubeLocalStorage)
              this.removeTokensFromHeaders()

              return resolve()
            }

            this.userTokens.accessToken = obj.access_token
            this.userTokens.refreshToken = obj.refresh_token
            UserTokens.saveToLocalStorage(peertubeLocalStorage, this.userTokens)

            this.setHeadersFromTokens()

            resolve()
          }).catch((refreshTokenError: any) => {
            reject(refreshTokenError)
          })
        })

        return refreshingTokenPromise
          .catch(() => {
            UserTokens.flushLocalStorage(peertubeLocalStorage)

            this.removeTokensFromHeaders()
          }).then(() => fetch(url, {
            ...options,

            headers: this.headers
          }))
      })
  }

  private setHeadersFromTokens () {
    this.headers.set('Authorization', this.getHeaderTokenValue())
  }

  private removeTokensFromHeaders () {
    this.headers.delete('Authorization')
  }
}
