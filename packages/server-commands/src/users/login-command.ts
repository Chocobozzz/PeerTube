import { pick } from '@peertube/peertube-core-utils'
import { HttpStatusCode, PeerTubeProblemDocument, ResultList, TokenSession } from '@peertube/peertube-models'
import { unwrapBody } from '../requests/index.js'
import { AbstractCommand, OverrideCommandOptions } from '../shared/index.js'

type LoginOptions = OverrideCommandOptions & {
  client?: { id?: string, secret?: string }
  user?: { username: string, password?: string }
  otpToken?: string

  userAgent?: string
  xForwardedFor?: string
}

export class LoginCommand extends AbstractCommand {
  async login (options: LoginOptions = {}) {
    const res = await this._login(options)

    return this.unwrapLoginBody(res.body)
  }

  async loginAndGetResponse (options: LoginOptions = {}) {
    const res = await this._login(options)

    return {
      res,
      body: this.unwrapLoginBody(res.body)
    }
  }

  getAccessToken (arg1?: { username: string, password?: string }): Promise<string>
  getAccessToken (arg1: string, password?: string): Promise<string>
  async getAccessToken (arg1?: { username: string, password?: string } | string, password?: string) {
    let user: { username: string, password?: string }

    if (!arg1) user = this.server.store.user
    else if (typeof arg1 === 'object') user = arg1
    else user = { username: arg1, password }

    try {
      const body = await this.login({ user })

      return body.access_token
    } catch (err) {
      throw new Error(`Cannot authenticate. Please check your username/password. (${err})`, { cause: err })
    }
  }

  loginUsingExternalToken (
    options: OverrideCommandOptions & {
      username: string
      externalAuthToken: string
    }
  ) {
    const { username, externalAuthToken } = options
    const path = '/api/v1/users/token'

    const body = {
      client_id: this.server.store.client.id,
      client_secret: this.server.store.client.secret,
      username,
      response_type: 'code',
      grant_type: 'password',
      scope: 'upload',
      externalAuthToken
    }

    return this.postBodyRequest({
      ...options,

      path,
      requestType: 'form',
      fields: body,
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  logout (
    options: OverrideCommandOptions & {
      token: string
    }
  ) {
    const path = '/api/v1/users/revoke-token'

    return unwrapBody<{ redirectUrl: string }>(this.postBodyRequest({
      ...options,

      path,
      requestType: 'form',
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.OK_200
    }))
  }

  refreshToken (
    options: OverrideCommandOptions & {
      refreshToken: string
      userAgent?: string
      xForwardedFor?: string
    }
  ) {
    const path = '/api/v1/users/token'

    const body = {
      client_id: this.server.store.client.id,
      client_secret: this.server.store.client.secret,
      refresh_token: options.refreshToken,
      response_type: 'code',
      grant_type: 'refresh_token'
    }

    const headers = options.userAgent
      ? { 'user-agent': options.userAgent }
      : {}

    return this.postBodyRequest({
      ...options,

      path,
      requestType: 'form',
      headers,
      xForwardedFor: options.xForwardedFor,
      fields: body,
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  getClient (options: OverrideCommandOptions = {}) {
    const path = '/api/v1/oauth-clients/local'

    return this.getRequestBody<{ client_id: string, client_secret: string }>({
      ...options,

      path,
      host: this.server.host,
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  private _login (options: LoginOptions) {
    const { client = this.server.store.client, user = this.server.store.user, otpToken } = options
    const path = '/api/v1/users/token'

    const body = {
      client_id: client.id,
      client_secret: client.secret,
      username: user.username,
      password: user.password ?? 'password',
      response_type: 'code',
      grant_type: 'password',
      scope: 'upload'
    }

    const headers: Record<string, string> = {}
    if (otpToken) headers['x-peertube-otp'] = otpToken
    if (options.userAgent) headers['user-agent'] = options.userAgent

    return this.postBodyRequest({
      ...options,

      path,
      headers,
      requestType: 'form',
      xForwardedFor: options.xForwardedFor,
      fields: body,
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  private unwrapLoginBody (body: any) {
    return body as { access_token: string, refresh_token: string } & PeerTubeProblemDocument
  }

  // ---------------------------------------------------------------------------

  listSessions (
    options: OverrideCommandOptions & {
      sort?: string
      start?: number
      count?: number
      userId: number
    }
  ) {
    const path = `/api/v1/users/${options.userId}/token-sessions`

    return this.getRequestBody<ResultList<TokenSession>>({
      ...options,

      path,
      query: pick(options, [ 'sort', 'start', 'count' ]),
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  revokeSession (
    options: OverrideCommandOptions & {
      userId: number
      sessionId: number
    }
  ) {
    const path = `/api/v1/users/${options.userId}/token-sessions/${options.sessionId}/revoke`

    return this.postBodyRequest({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }
}
