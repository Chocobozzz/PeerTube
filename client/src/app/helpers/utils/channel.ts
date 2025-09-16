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

        const allChannels = options.includeCollaborations
          ? [
            ...formatChannels(user.videoChannels, { editor: false }),
            ...formatChannels(user.videoChannelCollaborations, { editor: true })
          ]
          : formatChannels(user.videoChannels, { editor: false })

        return sortBy(allChannels, 'updatedAt').reverse()
      })
    )
}

// ---------------------------------------------------------------------------

function getAvatarPath (c: VideoChannel) {
  if (!c.avatars || c.avatars.length === 0) return undefined

  return minBy(c.avatars, 'width')?.path || c.avatars[0].path
}

function formatChannels (channel: (VideoChannel & { ownerAccountId?: number })[], { editor }: { editor: boolean }) {
  return channel
    .map(c => ({
      id: c.id,
      name: c.name,
      label: c.displayName,
      support: c.support,
      editor,
      avatarPath: getAvatarPath(c),
      ownerAccountId: c.ownerAccountId,
      updatedAt: c.updatedAt
    }))
}
