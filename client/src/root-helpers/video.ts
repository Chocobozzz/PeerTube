import { HTMLServerConfig, Video } from '@shared/models'

function buildVideoOrPlaylistEmbed (embedUrl: string, embedTitle: string) {
  const iframe = document.createElement('iframe')

  iframe.title = embedTitle
  iframe.width = '560'
  iframe.height = '315'
  iframe.src = embedUrl
  iframe.frameBorder = '0'
  iframe.allowFullscreen = true
  iframe.sandbox.add('allow-same-origin', 'allow-scripts', 'allow-popups')

  return iframe.outerHTML
}

function isP2PEnabled (video: Video, config: HTMLServerConfig, userP2PEnabled: boolean) {
  if (video.isLocal && config.tracker.enabled === false) return false
  if (isWebRTCDisabled()) return false

  return userP2PEnabled
}

export {
  buildVideoOrPlaylistEmbed,
  isP2PEnabled
}

// ---------------------------------------------------------------------------

function isWebRTCDisabled () {
  return !!((window as any).RTCPeerConnection || (window as any).mozRTCPeerConnection || (window as any).webkitRTCPeerConnection) === false
}
