import { pick } from '@peertube/peertube-core-utils'
import {
  HttpStatusCode,
  ResultList,
  UserRegistration,
  UserRegistrationRequest,
  UserRegistrationUpdateState
} from '@peertube/peertube-models'
import { unwrapBody } from '../requests/index.js'
import { AbstractCommand, OverrideCommandOptions } from '../shared/index.js'

export class RegistrationsCommand extends AbstractCommand {

  register (options: OverrideCommandOptions & Partial<UserRegistrationRequest> & Pick<UserRegistrationRequest, 'username'>) {
    const { password = 'password', email = options.username + '@example.com' } = options
    const path = '/api/v1/users/register'

    return this.postBodyRequest({
      ...options,

      path,
      fields: {
        ...pick(options, [ 'username', 'displayName', 'channel' ]),

        password,
        email
      },
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  requestRegistration (
    options: OverrideCommandOptions & Partial<UserRegistrationRequest> & Pick<UserRegistrationRequest, 'username' | 'registrationReason'>
  ) {
    const { password = 'password', email = options.username + '@example.com' } = options
    const path = '/api/v1/users/registrations/request'

    return unwrapBody<UserRegistration>(this.postBodyRequest({
      ...options,

      path,
      fields: {
        ...pick(options, [ 'username', 'displayName', 'channel', 'registrationReason' ]),

        password,
        email
      },
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.OK_200
    }))
  }

  // ---------------------------------------------------------------------------

  accept (options: OverrideCommandOptions & { id: number } & UserRegistrationUpdateState) {
    const { id } = options
    const path = '/api/v1/users/registrations/' + id + '/accept'

    return this.postBodyRequest({
      ...options,

      path,
      fields: pick(options, [ 'moderationResponse', 'preventEmailDelivery' ]),
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  reject (options: OverrideCommandOptions & { id: number } & UserRegistrationUpdateState) {
    const { id } = options
    const path = '/api/v1/users/registrations/' + id + '/reject'

    return this.postBodyRequest({
      ...options,

      path,
      fields: pick(options, [ 'moderationResponse', 'preventEmailDelivery' ]),
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  // ---------------------------------------------------------------------------

  delete (options: OverrideCommandOptions & {
    id: number
  }) {
    const { id } = options
    const path = '/api/v1/users/registrations/' + id

    return this.deleteRequest({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  // ---------------------------------------------------------------------------

  list (options: OverrideCommandOptions & {
    start?: number
    count?: number
    sort?: string
    search?: string
  } = {}) {
    const path = '/api/v1/users/registrations'

    return this.getRequestBody<ResultList<UserRegistration>>({
      ...options,

      path,
      query: pick(options, [ 'start', 'count', 'sort', 'search' ]),
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  // ---------------------------------------------------------------------------

  askSendVerifyEmail (options: OverrideCommandOptions & {
    email: string
  }) {
    const { email } = options
    const path = '/api/v1/users/registrations/ask-send-verify-email'

    return this.postBodyRequest({
      ...options,

      path,
      fields: { email },
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  verifyEmail (options: OverrideCommandOptions & {
    registrationId: number
    verificationString: string
  }) {
    const { registrationId, verificationString } = options
    const path = '/api/v1/users/registrations/' + registrationId + '/verify-email'

    return this.postBodyRequest({
      ...options,

      path,
      fields: {
        verificationString
      },
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }
}
