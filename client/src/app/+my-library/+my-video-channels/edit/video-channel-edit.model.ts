import { AuthUser } from '@app/core'
import { VideoChannel } from '@app/shared/shared-main/channel/video-channel.model'
import { AccountSummary, ActorImage, PlayerChannelSettings, VideoChannelCollaborator } from '@peertube/peertube-models'

type GeneralFormValue = {
  playerSettings: {
    theme: PlayerChannelSettings['theme']
  }

  channel: {
    name: string
    displayName: string
    description: string
    support: string
    bulkVideosSupportUpdate: boolean
  }
}

export class VideoChannelEdit {
  avatar: FormData
  banner: FormData

  playerSettings: {
    theme: PlayerChannelSettings['theme']
  }

  channel: {
    name: string
    displayName: string
    description: string
    support: string
    bulkVideosSupportUpdate: boolean
  }

  collaborators: VideoChannelCollaborator[]

  apiInfo: {
    id: number
    ownerAccount: AccountSummary
    avatars: VideoChannel['avatars']
    followersCount: VideoChannel['followersCount']
    bannerUrl: string
    support: string
  }

  commonChanged = false
  avatarChanged = false
  bannerChanged = false

  loadFromCreate (options: {
    playerSettings: PlayerChannelSettings
    user: AuthUser
  }) {
    const { playerSettings, user } = options

    this.playerSettings = {
      theme: playerSettings.theme
    }

    this.channel = {
      name: '',
      displayName: '',
      description: '',
      support: '',
      bulkVideosSupportUpdate: false
    }

    this.apiInfo = {
      id: undefined,
      ownerAccount: user.account,
      avatars: [],
      followersCount: 0,
      bannerUrl: undefined,
      support: undefined
    }

    this.collaborators = []
  }

  loadFromAPI (options: {
    channel: VideoChannel
    playerSettings: PlayerChannelSettings
    collaborators: VideoChannelCollaborator[]
  }) {
    const { channel, playerSettings, collaborators } = options

    this.playerSettings = {
      theme: playerSettings.theme
    }

    this.channel = {
      name: channel.name,
      displayName: channel.displayName,
      description: channel.description,
      support: channel.support,
      bulkVideosSupportUpdate: false
    }

    this.collaborators = [ ...collaborators ]

    this.apiInfo = {
      id: channel.id,
      avatars: channel.avatars,
      followersCount: channel.followersCount,
      bannerUrl: channel.bannerUrl,
      support: channel.support,
      ownerAccount: channel.ownerAccount
    }
  }

  hasChanges () {
    return this.commonChanged || this.avatarChanged || this.bannerChanged
  }

  resetChanges () {
    this.commonChanged = false
    this.avatarChanged = false
    this.bannerChanged = false

    this.apiInfo.support = this.channel.support
  }

  loadFromGeneralForm (form: GeneralFormValue) {
    this.playerSettings = form.playerSettings

    this.channel = {
      ...this.channel,
      ...form.channel
    }

    this.commonChanged = true
  }

  updateAvatarFromGeneralForm (formData: FormData) {
    this.avatar = formData
    this.avatarChanged = true
  }

  updateBannerFromGeneralForm (formData: FormData) {
    this.banner = formData
    this.bannerChanged = true
  }

  resetAvatarFromAPI () {
    this.avatar = null
    this.apiInfo.avatars = []
  }

  resetBannerFromAPI () {
    this.apiInfo.bannerUrl = null
  }

  updateAvatarsFromAPI (avatars: ActorImage[]) {
    this.apiInfo.avatars = avatars
  }

  updateBannerUrlFromAPI (bannerUrl: string) {
    this.apiInfo.bannerUrl = bannerUrl
  }
}
