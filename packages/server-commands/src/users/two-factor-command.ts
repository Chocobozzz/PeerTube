import { TOTP } from 'otpauth'
import { HttpStatusCode, TwoFactorEnableResult } from '@peertube/peertube-models'
import { unwrapBody } from '../requests/index.js'
import { AbstractCommand, OverrideCommandOptions } from '../shared/index.js'

export class TwoFactorCommand extends AbstractCommand {

  static buildOTP (options: {
    secret: string
  }) {
    const { secret } = options

    return new TOTP({
      issuer: 'PeerTube',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret
    })
  }

  request (options: OverrideCommandOptions & {
    userId: number
    currentPassword?: string
  }) {
    const { currentPassword, userId } = options

    const path = '/api/v1/users/' + userId + '/two-factor/request'

    return unwrapBody<TwoFactorEnableResult>(this.postBodyRequest({
      ...options,

      path,
      fields: { currentPassword },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    }))
  }

  confirmRequest (options: OverrideCommandOptions & {
    userId: number
    requestToken: string
    otpToken: string
  }) {
    const { userId, requestToken, otpToken } = options

    const path = '/api/v1/users/' + userId + '/two-factor/confirm-request'

    return this.postBodyRequest({
      ...options,

      path,
      fields: { requestToken, otpToken },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  disable (options: OverrideCommandOptions & {
    userId: number
    currentPassword?: string
  }) {
    const { userId, currentPassword } = options
    const path = '/api/v1/users/' + userId + '/two-factor/disable'

    return this.postBodyRequest({
      ...options,

      path,
      fields: { currentPassword },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  async requestAndConfirm (options: OverrideCommandOptions & {
    userId: number
    currentPassword?: string
  }) {
    const { userId, currentPassword } = options

    const { otpRequest } = await this.request({ userId, currentPassword })

    await this.confirmRequest({
      userId,
      requestToken: otpRequest.requestToken,
      otpToken: TwoFactorCommand.buildOTP({ secret: otpRequest.secret }).generate()
    })

    return otpRequest
  }
}
