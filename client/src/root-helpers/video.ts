import { HTMLServerConfig, User, Video, VideoPrivacy, VideoPrivacyType } from '@peertube/peertube-models'

export function buildVideoOrPlaylistEmbed (options: {
  embedUrl: string
  embedTitle: string
  aspectRatio?: number
  responsive?: boolean
}) {
  const { embedUrl, embedTitle, aspectRatio, responsive = false } = options

  const iframe = document.createElement('iframe')

  iframe.title = embedTitle
  iframe.width = responsive ? '100%' : '560'
  iframe.height = responsive ? '100%' : '315'
  iframe.src = embedUrl
  iframe.style.border = '0'
  iframe.allow = 'fullscreen'
  iframe.sandbox.add('allow-same-origin', 'allow-scripts', 'allow-popups', 'allow-forms')

  if (responsive) {
    const wrapper = document.createElement('div')

    wrapper.style.position = 'relative'
    wrapper.style.paddingTop = aspectRatio
      ? (1 / aspectRatio * 100).toFixed(2) + '%'
      : '56.25%'

    iframe.style.position = 'absolute'
    iframe.style.inset = '0'

    wrapper.appendChild(iframe)

    return wrapper.outerHTML
  }

  return iframe.outerHTML
}

export function isP2PEnabled (video: Video, config: HTMLServerConfig, userP2PEnabled: boolean) {
  if (video.isLocal && config.tracker.enabled === false) return false
  if (isWebRTCDisabled()) return false

  return userP2PEnabled
}

export function videoRequiresUserAuth (video: Video, videoPassword?: string) {
  return new Set<VideoPrivacyType>([ VideoPrivacy.PRIVATE, VideoPrivacy.INTERNAL ]).has(video.privacy.id) ||
    (video.privacy.id === VideoPrivacy.PASSWORD_PROTECTED && !videoPassword)
}

export function videoRequiresFileToken (video: Video) {
  return new Set<VideoPrivacyType>([ VideoPrivacy.PRIVATE, VideoPrivacy.INTERNAL, VideoPrivacy.PASSWORD_PROTECTED ]).has(video.privacy.id)
}

export function isVideoNSFWWarnedForUser (video: Video, config: HTMLServerConfig, user: User) {
  if (video.nsfw === false) return false

  if (!user) {
    return config.instance.defaultNSFWPolicy === 'warn' || config.instance.defaultNSFWPolicy === 'blur'
  }

  if ((user.nsfwFlagsWarned & video.nsfwFlags) !== 0) return true
  if ((user.nsfwFlagsBlurred & video.nsfwFlags) !== 0) return true
  if ((user.nsfwFlagsDisplayed & video.nsfwFlags) !== 0) return false
  if ((user.nsfwFlagsHidden & video.nsfwFlags) !== 0) return false

  return user.nsfwPolicy === 'warn' || user.nsfwPolicy === 'blur'
}

export function isVideoNSFWBlurForUser (video: Video, config: HTMLServerConfig, user: User) {
  if (video.nsfw === false) return false

  if (!user) return config.instance.defaultNSFWPolicy === 'blur'

  if ((user.nsfwFlagsBlurred & video.nsfwFlags) !== 0) return true
  if ((user.nsfwFlagsWarned & video.nsfwFlags) !== 0) return false
  if ((user.nsfwFlagsDisplayed & video.nsfwFlags) !== 0) return false
  if ((user.nsfwFlagsHidden & video.nsfwFlags) !== 0) return false

  return user.nsfwPolicy === 'blur'
}

export function isVideoNSFWHiddenForUser (video: Video, config: HTMLServerConfig, user: User) {
  if (video.nsfw === false) return false

  if (!user) return config.instance.defaultNSFWPolicy === 'do_not_list'

  if ((user.nsfwFlagsHidden & video.nsfwFlags) !== 0) return true
  if ((user.nsfwFlagsBlurred & video.nsfwFlags) !== 0) return false
  if ((user.nsfwFlagsWarned & video.nsfwFlags) !== 0) return false
  if ((user.nsfwFlagsDisplayed & video.nsfwFlags) !== 0) return false

  return user.nsfwPolicy === 'do_not_list'
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function isWebRTCDisabled () {
  return !!((window as any).RTCPeerConnection || (window as any).mozRTCPeerConnection || (window as any).webkitRTCPeerConnection) === false
}
