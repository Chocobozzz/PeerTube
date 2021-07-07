import { pick } from 'lodash'
import { ActivityPubActorType, ActorFollow, FollowState, ResultList } from '@shared/models'
import { HttpStatusCode } from '../../core-utils/miscs/http-error-codes'
import { AbstractCommand, OverrideCommandOptions } from '../shared'
import { ServerInfo } from './servers'

export class FollowsCommand extends AbstractCommand {

  getFollowers (options: OverrideCommandOptions & {
    start: number
    count: number
    sort: string
    search?: string
    actorType?: ActivityPubActorType
    state?: FollowState
  }) {
    const path = '/api/v1/server/followers'

    const toPick = [ 'start', 'count', 'sort', 'search', 'state', 'actorType' ]
    const query = pick(options, toPick)

    return this.getRequestBody<ResultList<ActorFollow>>({
      ...options,

      token: null,

      path,
      query,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  getFollowings (options: OverrideCommandOptions & {
    start: number
    count: number
    sort: string
    search?: string
    actorType?: ActivityPubActorType
    state?: FollowState
  }) {
    const path = '/api/v1/server/following'

    const toPick = [ 'start', 'count', 'sort', 'search', 'state', 'actorType' ]
    const query = pick(options, toPick)

    return this.getRequestBody<ResultList<ActorFollow>>({
      ...options,

      token: null,

      path,
      query,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  follow (options: OverrideCommandOptions & {
    targets: string[]
  }) {
    const path = '/api/v1/server/following'

    const hosts = options.targets.map(f => f.replace(/^http:\/\//, ''))

    return this.postBodyRequest({
      ...options,

      path,
      fields: { hosts },
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  async unfollow (options: OverrideCommandOptions & {
    target: ServerInfo
  }) {
    const path = '/api/v1/server/following/' + options.target.host

    return this.deleteRequest({
      ...options,

      path,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  acceptFollower (options: OverrideCommandOptions & {
    follower: string
  }) {
    const path = '/api/v1/server/followers/' + options.follower + '/accept'

    return this.postBodyRequest({
      ...options,

      path,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  rejectFollower (options: OverrideCommandOptions & {
    follower: string
  }) {
    const path = '/api/v1/server/followers/' + options.follower + '/reject'

    return this.postBodyRequest({
      ...options,

      path,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  removeFollower (options: OverrideCommandOptions & {
    follower: ServerInfo
  }) {
    const path = '/api/v1/server/followers/peertube@' + options.follower.host

    return this.deleteRequest({
      ...options,

      path,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }
}
