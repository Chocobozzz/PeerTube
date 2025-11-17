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
// Private
// ---------------------------------------------------------------------------

function formatChannels (channel: (VideoChannel & { ownerAccountId?: number })[], { editor }: { editor: boolean }) {
  return channel
    .map(c => ({
      id: c.id,
      name: c.name,
      label: c.displayName,
      support: c.support,
      editor,
      avatarFileUrl: getAvatarFileUrl(c),
      ownerAccountId: c.ownerAccountId,
      updatedAt: c.updatedAt
    }))
}

function getAvatarFileUrl (c: VideoChannel) {
  if (!c.avatars || c.avatars.length === 0) return undefined

  return minBy(c.avatars, 'width')?.fileUrl || c.avatars[0].fileUrl
}
