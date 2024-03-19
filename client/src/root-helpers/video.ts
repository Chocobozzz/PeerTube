import { HTMLServerConfig, Video, VideoPrivacy, VideoPrivacyType } from '@peertube/peertube-models'

function buildVideoOrPlaylistEmbed (options: {
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
  iframe.frameBorder = '0'
  iframe.allowFullscreen = true
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

function isP2PEnabled (video: Video, config: HTMLServerConfig, userP2PEnabled: boolean) {
  if (video.isLocal && config.tracker.enabled === false) return false
  if (isWebRTCDisabled()) return false

  return userP2PEnabled
}

function videoRequiresUserAuth (video: Video, videoPassword?: string) {
  return new Set<VideoPrivacyType>([ VideoPrivacy.PRIVATE, VideoPrivacy.INTERNAL ]).has(video.privacy.id) ||
    (video.privacy.id === VideoPrivacy.PASSWORD_PROTECTED && !videoPassword)

}

function videoRequiresFileToken (video: Video) {
  return new Set<VideoPrivacyType>([ VideoPrivacy.PRIVATE, VideoPrivacy.INTERNAL, VideoPrivacy.PASSWORD_PROTECTED ]).has(video.privacy.id)
}

export {
  buildVideoOrPlaylistEmbed,
  isP2PEnabled,
  videoRequiresUserAuth,
  videoRequiresFileToken
}

// ---------------------------------------------------------------------------

function isWebRTCDisabled () {
  return !!((window as any).RTCPeerConnection || (window as any).mozRTCPeerConnection || (window as any).webkitRTCPeerConnection) === false
}
