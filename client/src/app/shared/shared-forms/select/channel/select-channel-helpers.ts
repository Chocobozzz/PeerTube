import { VideoChannel } from '@app/shared/shared-main/channel/video-channel.model'
import { sortBy } from '@peertube/peertube-core-utils'
import { UserVideoChannel, VideoChannel as VideoChannelServer } from '@peertube/peertube-models'
import { findAppropriateImageFileUrl } from '@root-helpers/index'
import { first, map } from 'rxjs/operators'
import { SelectChannelItem } from '../../../../../types/select-options-item.model'
import { AuthService } from '../../../../core/auth'

// List channels of selected accountName
// Set the currentChannelId to correctly display channel editor/owner information
export function listChannelsForSelect (options: {
  authService: AuthService
  includeCollaborations: boolean
}) {
  const { authService } = options

  return authService.userInformationLoaded
    .pipe(
      first(),
      map(() => buildUserChannelsForSelect(options))
    )
}

export function buildUserChannelsForSelect (options: {
  authService: AuthService
  includeCollaborations: boolean
}) {
  const { authService, includeCollaborations } = options

  const user = authService.getUser()
  const collaborate = user.isCollaboratingToChannels()

  const allChannels = includeCollaborations
    ? [
      ...formatChannelsForSelect(user.videoChannels, { editor: false, owner: true, collaborate }),
      ...formatChannelsForSelect(user.videoChannelCollaborations, { editor: true, owner: false, collaborate })
    ]
    : formatChannelsForSelect(user.videoChannels, { editor: false, owner: false, collaborate })

  return sortBy(allChannels, 'updatedAt').reverse()
}

export function formatChannelForSelect (channel: UserVideoChannel, options: {
  editor: boolean
  owner: boolean
  collaborate: boolean
}): SelectChannelItem {
  const { editor, collaborate, owner } = options

  return {
    id: channel.id,
    name: channel.name,
    label: channel.displayName,
    support: channel.support,
    editor,
    collaborate,
    owner,
    imageUrl: getAvatarFileUrl(channel),

    displayName: channel.displayName,
    ownerAccountId: channel.ownerAccountId,
    ownerAccountName: channel.ownerAccountName,

    updatedAt: channel.updatedAt
  }
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function formatChannelsForSelect (channel: UserVideoChannel[], options: {
  editor: boolean
  owner: boolean
  collaborate: boolean
}): SelectChannelItem[] {
  const { editor, collaborate, owner } = options

  return channel.map(c => formatChannelForSelect(c, { editor, collaborate, owner }))
}

function getAvatarFileUrl (channel: VideoChannelServer) {
  if (!channel.avatars || channel.avatars.length === 0) {
    return VideoChannel.GET_DEFAULT_AVATAR_URL(21)
  }

  return findAppropriateImageFileUrl(channel.avatars, 21)
}
