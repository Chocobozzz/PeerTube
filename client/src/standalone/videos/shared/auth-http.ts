import { HttpStatusCode, OAuth2ErrorCode, OAuth2ErrorCodeType, UserRefreshToken } from '@peertube/peertube-models'
import { OAuthUserTokens, objectToUrlEncoded } from '../../../root-helpers'
import { peertubeLocalStorage } from '../../../root-helpers/peertube-web-storage'

export class AuthHTTP {
  private readonly LS_OAUTH_CLIENT_KEYS = {
    CLIENT_ID: 'client_id',
    CLIENT_SECRET: 'client_secret'
  }

  private userOAuthTokens: OAuthUserTokens

  private headers = new Headers()

  constructor () {
    this.userOAuthTokens = OAuthUserTokens.getUserTokens(peertubeLocalStorage)

    if (this.userOAuthTokens) this.setHeadersFromTokens()
  }

  fetch (url: string, { optionalAuth, method }: { optionalAuth: boolean, method?: string }, videoPassword?: string) {
    let refreshFetchOptions: { headers?: Headers } = {}

    if (videoPassword) this.headers.set('x-peertube-video-password', videoPassword)

    if (videoPassword || optionalAuth) refreshFetchOptions = { headers: this.headers }

    return this.refreshFetch(url.toString(), { ...refreshFetchOptions, method })
  }

  getHeaderTokenValue () {
    if (!this.userOAuthTokens) return null

    return `${this.userOAuthTokens.tokenType} ${this.userOAuthTokens.accessToken}`
  }

  isLoggedIn () {
    return !!this.userOAuthTokens
  }

  private refreshFetch (url: string, options?: RequestInit) {
    return fetch(url, options)
      .then((res: Response) => {
        if (res.status !== HttpStatusCode.UNAUTHORIZED_401) return res

        const refreshingTokenPromise = new Promise<void>((resolve, reject) => {
          const clientId: string = peertubeLocalStorage.getItem(this.LS_OAUTH_CLIENT_KEYS.CLIENT_ID)
          const clientSecret: string = peertubeLocalStorage.getItem(this.LS_OAUTH_CLIENT_KEYS.CLIENT_SECRET)

          const headers = new Headers()
          headers.set('Content-Type', 'application/x-www-form-urlencoded')

          const data = {
            refresh_token: this.userOAuthTokens.refreshToken,
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
          }).then((obj: UserRefreshToken & { code?: OAuth2ErrorCodeType }) => {
            if (!obj || obj.code === OAuth2ErrorCode.INVALID_GRANT) {
              OAuthUserTokens.flushLocalStorage(peertubeLocalStorage)
              this.removeTokensFromHeaders()

              return resolve()
            }

            this.userOAuthTokens.accessToken = obj.access_token
            this.userOAuthTokens.refreshToken = obj.refresh_token
            OAuthUserTokens.saveToLocalStorage(peertubeLocalStorage, this.userOAuthTokens)

            this.setHeadersFromTokens()

            resolve()
          }).catch((refreshTokenError: any) => {
            reject(refreshTokenError)
          })
        })

        return refreshingTokenPromise
          .catch(() => {
            OAuthUserTokens.flushLocalStorage(peertubeLocalStorage)

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
