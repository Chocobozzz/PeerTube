import { minBy } from '@peertube/peertube-core-utils'
import { VideoChannel } from '@peertube/peertube-models'
import { first, map } from 'rxjs/operators'
import { SelectChannelItem } from 'src/types/select-options-item.model'
import { AuthService } from '../../core/auth'

function listUserChannelsForSelect (authService: AuthService) {
  return authService.userInformationLoaded
    .pipe(
      first(),
      map(() => {
        const user = authService.getUser()
        if (!user) return undefined

        const videoChannels = user.videoChannels
        if (Array.isArray(videoChannels) === false) return undefined

        return videoChannels
          .sort((a, b) => {
            if (a.updatedAt < b.updatedAt) return 1
            if (a.updatedAt > b.updatedAt) return -1
            return 0
          })
          .map(c => ({
            id: c.id,
            label: c.displayName,
            support: c.support,
            avatarPath: getAvatarPath(c)
          }) as SelectChannelItem)
      })
    )
}

export {
  listUserChannelsForSelect
}

// ---------------------------------------------------------------------------

function getAvatarPath (c: VideoChannel) {
  if (!c.avatars || c.avatars.length === 0) return undefined

  return minBy(c.avatars, 'width')?.path || c.avatars[0].path
}
