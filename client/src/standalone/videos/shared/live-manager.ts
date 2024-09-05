import { LiveVideoEventPayload, VideoDetails, VideoState, VideoStateType } from '@peertube/peertube-models'
import { Socket } from 'socket.io-client'
import { PlayerHTML } from './player-html'
import { Translations } from './translations'
import { getBackendUrl } from './url'

export class LiveManager {
  private liveSocket: Socket

  private stateChangeListeners = new Map<string, (payload: LiveVideoEventPayload) => void>()
  private forceEndListeners = new Map<string, () => void>()

  constructor (
    private readonly playerHTML: PlayerHTML
  ) {

  }

  async listenForChanges (options: {
    video: VideoDetails

    onPublishedVideo: () => any

    onForceEnd: () => any
  }) {
    const { video, onPublishedVideo, onForceEnd } = options

    if (!this.liveSocket) {
      const io = (await import('socket.io-client')).io
      this.liveSocket = io(getBackendUrl() + '/live-videos')
    }

    const stateChangeListener = (payload: LiveVideoEventPayload) => {
      if (payload.state === VideoState.PUBLISHED) {
        this.playerHTML.removeInformation()
        onPublishedVideo()
        return
      }
    }

    const forceEndListener = () => {
      onForceEnd()
    }

    this.liveSocket.on('state-change', stateChangeListener)
    this.liveSocket.on('force-end', forceEndListener)

    this.stateChangeListeners.set(video.uuid, stateChangeListener)
    this.forceEndListeners.set(video.uuid, forceEndListener)

    this.liveSocket.emit('subscribe', { videoId: video.id })
  }

  stopListeningForChanges (video: VideoDetails) {
    {
      const listener = this.stateChangeListeners.get(video.uuid)
      if (listener) this.liveSocket.off('state-change', listener)
    }

    {
      const listener = this.forceEndListeners.get(video.uuid)
      if (listener) this.liveSocket.off('force-end', listener)
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
    this.playerHTML.displayInformation('This live is not currently streaming.', translations)
  }

  private displayEndedLiveInfo (translations: Translations) {
    this.playerHTML.displayInformation('This live has ended.', translations)

  }
}
