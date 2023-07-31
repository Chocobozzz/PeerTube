import { Socket } from 'socket.io-client'
import { LiveVideoEventPayload, VideoDetails, VideoState, VideoStateType } from '@peertube/peertube-models'
import { PlayerHTML } from './player-html'
import { Translations } from './translations'

export class LiveManager {
  private liveSocket: Socket

  private listeners = new Map<string, (payload: LiveVideoEventPayload) => void>()

  constructor (
    private readonly playerHTML: PlayerHTML
  ) {

  }

  async listenForChanges (options: {
    video: VideoDetails
    onPublishedVideo: () => any
  }) {
    const { video, onPublishedVideo } = options

    if (!this.liveSocket) {
      const io = (await import('socket.io-client')).io
      this.liveSocket = io(window.location.origin + '/live-videos')
    }

    const listener = (payload: LiveVideoEventPayload) => {
      if (payload.state === VideoState.PUBLISHED) {
        this.playerHTML.removeInformation()
        onPublishedVideo()
        return
      }
    }

    this.liveSocket.on('state-change', listener)
    this.listeners.set(video.uuid, listener)

    this.liveSocket.emit('subscribe', { videoId: video.id })
  }

  stopListeningForChanges (video: VideoDetails) {
    const listener = this.listeners.get(video.uuid)
    if (listener) {
      this.liveSocket.off('state-change', listener)
    }

    this.liveSocket.emit('unsubscribe', { videoId: video.id })
  }

  displayInfo (options: {
    state: VideoStateType
    translations: Translations
  }) {
    const { state, translations } = options

    if (state === VideoState.WAITING_FOR_LIVE) {
      this.displayWaitingForLiveInfo(translations)
      return
    }

    if (state === VideoState.LIVE_ENDED) {
      this.displayEndedLiveInfo(translations)
      return
    }
  }

  private displayWaitingForLiveInfo (translations: Translations) {
    this.playerHTML.displayInformation('This live has not started yet.', translations)
  }

  private displayEndedLiveInfo (translations: Translations) {
    this.playerHTML.displayInformation('This live has ended.', translations)

  }
}
