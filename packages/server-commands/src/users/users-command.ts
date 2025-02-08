import { omit, pick } from '@peertube/peertube-core-utils'
import {
  HttpStatusCode,
  MyUser,
  ResultList,
  ScopedToken,
  User,
  UserAdminFlagType,
  UserCreateResult,
  UserRole,
  UserRoleType,
  UserUpdate,
  UserUpdateMe,
  UserVideoQuota,
  UserVideoRate
} from '@peertube/peertube-models'
import { unwrapBody } from '../requests/index.js'
import { AbstractCommand, OverrideCommandOptions } from '../shared/index.js'

export class UsersCommand extends AbstractCommand {

  askResetPassword (options: OverrideCommandOptions & {
    email: string
  }) {
    const { email } = options
    const path = '/api/v1/users/ask-reset-password'

    return this.postBodyRequest({
      ...options,

      path,
      fields: { email },
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  resetPassword (options: OverrideCommandOptions & {
    userId: number
    verificationString: string
    password: string
  }) {
    const { userId, verificationString, password } = options
    const path = '/api/v1/users/' + userId + '/reset-password'

    return this.postBodyRequest({
      ...options,

      path,
      fields: { password, verificationString },
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  // ---------------------------------------------------------------------------

  askSendVerifyEmail (options: OverrideCommandOptions & {
    email: string
  }) {
    const { email } = options
    const path = '/api/v1/users/ask-send-verify-email'

    return this.postBodyRequest({
      ...options,

      path,
      fields: { email },
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  verifyEmail (options: OverrideCommandOptions & {
    userId: number
    verificationString: string
    isPendingEmail?: boolean // default false
  }) {
    const { userId, verificationString, isPendingEmail = false } = options
    const path = '/api/v1/users/' + userId + '/verify-email'

    return this.postBodyRequest({
      ...options,

      path,
      fields: {
        verificationString,
        isPendingEmail
      },
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  // ---------------------------------------------------------------------------

  banUser (options: OverrideCommandOptions & {
    userId: number
    reason?: string
  }) {
    const { userId, reason } = options
    const path = '/api/v1/users' + '/' + userId + '/block'

    return this.postBodyRequest({
      ...options,

      path,
      fields: { reason },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  unbanUser (options: OverrideCommandOptions & {
    userId: number
  }) {
    const { userId } = options
    const path = '/api/v1/users' + '/' + userId + '/unblock'

    return this.postBodyRequest({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  // ---------------------------------------------------------------------------

  getMyScopedTokens (options: OverrideCommandOptions = {}) {
    const path = '/api/v1/users/scoped-tokens'

    return this.getRequestBody<ScopedToken>({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  renewMyScopedTokens (options: OverrideCommandOptions = {}) {
    const path = '/api/v1/users/scoped-tokens'

    return this.postBodyRequest({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  // ---------------------------------------------------------------------------

  create (options: OverrideCommandOptions & {
    username: string
    password?: string
    videoQuota?: number
    videoQuotaDaily?: number
    role?: UserRoleType
    adminFlags?: UserAdminFlagType
    email?: string
  }) {
    const {
      username,
      adminFlags,
      password = 'password',
      videoQuota,
      videoQuotaDaily,
      role = UserRole.USER,
      email = username + '@example.com'
    } = options

    const path = '/api/v1/users'

    return unwrapBody<{ user: UserCreateResult }>(this.postBodyRequest({
      ...options,

      path,
      fields: {
        username,
        password,
        role,
        adminFlags,
        email,
        videoQuota,
        videoQuotaDaily
      },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })).then(res => res.user)
  }

  async generate (username: string, role?: UserRoleType) {
    const password = 'password'
    const user = await this.create({ username, password, role })

    const token = await this.server.login.getAccessToken({ username, password })

    const me = await this.getMyInfo({ token })

    return {
      token,
      userId: user.id,
      userChannelId: me.videoChannels[0].id,
      userChannelName: me.videoChannels[0].name,
      password
    }
  }

  async generateUserAndToken (username: string, role?: UserRoleType) {
    const password = 'password'
    await this.create({ username, password, role })

    return this.server.login.getAccessToken({ username, password })
  }

  // ---------------------------------------------------------------------------

  getMyInfo (options: OverrideCommandOptions = {}) {
    const path = '/api/v1/users/me'

    return this.getRequestBody<MyUser>({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  getMyQuotaUsed (options: OverrideCommandOptions = {}) {
    const path = '/api/v1/users/me/video-quota-used'

    return this.getRequestBody<UserVideoQuota>({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  getMyRating (options: OverrideCommandOptions & {
    videoId: number | string
  }) {
    const { videoId } = options
    const path = '/api/v1/users/me/videos/' + videoId + '/rating'

    return this.getRequestBody<UserVideoRate>({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  deleteMe (options: OverrideCommandOptions = {}) {
    const path = '/api/v1/users/me'

    return this.deleteRequest({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  updateMe (options: OverrideCommandOptions & UserUpdateMe) {
    const path = '/api/v1/users/me'

    const toSend: UserUpdateMe = omit(options, [ 'expectedStatus', 'token' ])

    return this.putBodyRequest({
      ...options,

      path,
      fields: toSend,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  updateMyAvatar (options: OverrideCommandOptions & {
    fixture: string
  }) {
    const { fixture } = options
    const path = '/api/v1/users/me/avatar/pick'

    return this.updateImageRequest({
      ...options,

      path,
      fixture,
      fieldname: 'avatarfile',

      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  // ---------------------------------------------------------------------------

  get (options: OverrideCommandOptions & {
    userId: number
    withStats?: boolean // default false
  }) {
    const { userId, withStats } = options
    const path = '/api/v1/users/' + userId

    return this.getRequestBody<User>({
      ...options,

      path,
      query: { withStats },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  list (options: OverrideCommandOptions & {
    start?: number
    count?: number
    sort?: string
    search?: string
    blocked?: boolean
  } = {}) {
    const path = '/api/v1/users'

    return this.getRequestBody<ResultList<User>>({
      ...options,

      path,
      query: pick(options, [ 'start', 'count', 'sort', 'search', 'blocked' ]),
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  remove (options: OverrideCommandOptions & {
    userId: number
  }) {
    const { userId } = options
    const path = '/api/v1/users/' + userId

    return this.deleteRequest({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  update (options: OverrideCommandOptions & {
    userId: number
    email?: string
    emailVerified?: boolean
    videoQuota?: number
    videoQuotaDaily?: number
    password?: string
    adminFlags?: UserAdminFlagType
    pluginAuth?: string
    role?: UserRoleType
  }) {
    const path = '/api/v1/users/' + options.userId

    const toSend: UserUpdate = {}
    if (options.password !== undefined && options.password !== null) toSend.password = options.password
    if (options.email !== undefined && options.email !== null) toSend.email = options.email
    if (options.emailVerified !== undefined && options.emailVerified !== null) toSend.emailVerified = options.emailVerified
    if (options.videoQuota !== undefined && options.videoQuota !== null) toSend.videoQuota = options.videoQuota
    if (options.videoQuotaDaily !== undefined && options.videoQuotaDaily !== null) toSend.videoQuotaDaily = options.videoQuotaDaily
    if (options.role !== undefined && options.role !== null) toSend.role = options.role
    if (options.adminFlags !== undefined && options.adminFlags !== null) toSend.adminFlags = options.adminFlags
    if (options.pluginAuth !== undefined) toSend.pluginAuth = options.pluginAuth

    return this.putBodyRequest({
      ...options,

      path,
      fields: toSend,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }
}
