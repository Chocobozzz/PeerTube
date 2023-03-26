import { HTMLServerConfig, Video, VideoPrivacy } from '@shared/models'

function buildVideoOrPlaylistEmbed (options: {
  embedUrl: string
  embedTitle: string
  responsive?: boolean
}) {
  const { embedUrl, embedTitle, responsive = false } = options

  const iframe = document.createElement('iframe')

  iframe.title = embedTitle
  iframe.width = responsive ? '100%' : '560'
  iframe.height = responsive ? '100%' : '315'
  iframe.src = embedUrl
  iframe.frameBorder = '0'
  iframe.allowFullscreen = true
  iframe.sandbox.add('allow-same-origin', 'allow-scripts', 'allow-popups')

  if (responsive) {
    const wrapper = document.createElement('div')

    wrapper.style.position = 'relative'
    wrapper.style['padding-top'] = '56.25%'

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

function videoRequiresAuth (video: Video) {
  return new Set([ VideoPrivacy.PRIVATE, VideoPrivacy.INTERNAL ]).has(video.privacy.id)
}

export {
  buildVideoOrPlaylistEmbed,
  isP2PEnabled,
  videoRequiresAuth
}

// ---------------------------------------------------------------------------

function isWebRTCDisabled () {
  return !!((window as any).RTCPeerConnection || (window as any).mozRTCPeerConnection || (window as any).webkitRTCPeerConnection) === false
}
