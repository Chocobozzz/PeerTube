import { HttpStatusCode, ResultList, VideoChannelCollaborator } from '@peertube/peertube-models'
import { unwrapBody } from '../requests/index.js'
import { AbstractCommand, OverrideCommandOptions } from '../shared/index.js'

export class ChannelCollaboratorsCommand extends AbstractCommand {
  list (
    options: OverrideCommandOptions & {
      channel: string
    }
  ) {
    const { channel } = options
    const path = '/api/v1/video-channels/' + channel + '/collaborators'

    return this.getRequestBody<ResultList<VideoChannelCollaborator>>({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  async invite (
    options: OverrideCommandOptions & {
      channel: string
      target: string
    }
  ) {
    const { channel, target } = options
    const path = '/api/v1/video-channels/' + channel + '/collaborators/invite'

    const body = await unwrapBody<{ collaborator: VideoChannelCollaborator }>(this.postBodyRequest({
      ...options,

      path,
      fields: {
        accountHandle: target
      },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    }))

    return body.collaborator
  }

  accept (
    options: OverrideCommandOptions & {
      channel: string
      id: number
    }
  ) {
    const { id, channel } = options
    const path = '/api/v1/video-channels/' + channel + '/collaborators/' + id + '/accept'

    return this.postBodyRequest({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  reject (
    options: OverrideCommandOptions & {
      channel: string
      id: number
    }
  ) {
    const { id, channel } = options
    const path = '/api/v1/video-channels/' + channel + '/collaborators/' + id + '/reject'

    return this.postBodyRequest({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  remove (
    options: OverrideCommandOptions & {
      channel: string
      id: number
    }
  ) {
    const { id, channel } = options
    const path = '/api/v1/video-channels/' + channel + '/collaborators/' + id

    return this.deleteRequest({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  // ---------------------------------------------------------------------------

  async createEditor (user: string, channel: string) {
    const collaboratorToken = await this.server.users.generateUserAndToken(user)

    const { id } = await this.invite({ channel, target: user })

    await this.accept({ channel, id, token: collaboratorToken })

    return collaboratorToken
  }

  async createInvited (user: string, channel: string) {
    const collaboratorToken = await this.server.users.generateUserAndToken(user)

    await this.invite({ channel, target: user })

    return collaboratorToken
  }
}
