import { minBy, sortBy } from '@peertube/peertube-core-utils'
import { VideoChannel } from '@peertube/peertube-models'
import { first, map } from 'rxjs/operators'
import { AuthService } from '../../core/auth'

export function listUserChannelsForSelect (authService: AuthService, options: { includeCollaborations: boolean }) {
  return authService.userInformationLoaded
    .pipe(
      first(),
      map(() => {
        const user = authService.getUser()
        const collaborate = user.isCollaboratingToChannels()

        const allChannels = options.includeCollaborations
          ? [
            ...formatChannels(user.videoChannels, { editor: false, owner: true, collaborate }),
            ...formatChannels(user.videoChannelCollaborations, { editor: true, owner: false, collaborate })
          ]
          : formatChannels(user.videoChannels, { editor: false, owner: false, collaborate })

        return sortBy(allChannels, 'updatedAt').reverse()
      })
    )
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function formatChannels (channel: (VideoChannel & { ownerAccountId?: number })[], options: {
  editor: boolean
  owner: boolean
  collaborate: boolean
}) {
  const { editor, collaborate, owner } = options

  return channel
    .map(c => ({
      id: c.id,
      name: c.name,
      label: c.displayName,
      support: c.support,
      editor,
      collaborate,
      owner,
      avatarFileUrl: getAvatarFileUrl(c),
      ownerAccountId: c.ownerAccountId,
      updatedAt: c.updatedAt
    }))
}

function getAvatarFileUrl (c: VideoChannel) {
  if (!c.avatars || c.avatars.length === 0) return undefined

  return minBy(c.avatars, 'width')?.fileUrl || c.avatars[0].fileUrl
}
