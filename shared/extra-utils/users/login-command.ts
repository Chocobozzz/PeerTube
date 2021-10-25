import { HttpStatusCode, PeerTubeProblemDocument } from '@shared/models'
import { unwrapBody } from '../requests'
import { AbstractCommand, OverrideCommandOptions } from '../shared'

export class LoginCommand extends AbstractCommand {

  login (options: OverrideCommandOptions & {
    client?: { id?: string, secret?: string }
    user?: { username: string, password?: string }
  } = {}) {
    const { client = this.server.store.client, user = this.server.store.user } = options
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

    return unwrapBody<{ access_token: string, refresh_token: string } & PeerTubeProblemDocument>(this.postBodyRequest({
      ...options,

      path,
      requestType: 'form',
      fields: body,
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.OK_200
    }))
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
      throw new Error(`Cannot authenticate. Please check your username/password. (${err})`)
    }
  }

  loginUsingExternalToken (options: OverrideCommandOptions & {
    username: string
    externalAuthToken: string
  }) {
    const { username, externalAuthToken } = options
    const path = '/api/v1/users/token'

    const body = {
      client_id: this.server.store.client.id,
      client_secret: this.server.store.client.secret,
      username: username,
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

  logout (options: OverrideCommandOptions & {
    token: string
  }) {
    const path = '/api/v1/users/revoke-token'

    return unwrapBody<{ redirectUrl: string }>(this.postBodyRequest({
      ...options,

      path,
      requestType: 'form',
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.OK_200
    }))
  }

  refreshToken (options: OverrideCommandOptions & {
    refreshToken: string
  }) {
    const path = '/api/v1/users/token'

    const body = {
      client_id: this.server.store.client.id,
      client_secret: this.server.store.client.secret,
      refresh_token: options.refreshToken,
      response_type: 'code',
      grant_type: 'refresh_token'
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
}
