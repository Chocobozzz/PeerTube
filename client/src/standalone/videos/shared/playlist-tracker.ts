import { VideoPlaylist, VideoPlaylistElement } from '@peertube/peertube-models'
import { logger } from '../../../root-helpers'

export class PlaylistTracker {
  private currentPlaylistElement: VideoPlaylistElement

  constructor (
    private readonly playlist: VideoPlaylist,
    private readonly playlistElements: VideoPlaylistElement[]
  ) {

  }

  getPlaylist () {
    return this.playlist
  }

  getPlaylistElements () {
    return this.playlistElements
  }

  hasNextPlaylistElement (position?: number) {
    return !!this.getNextPlaylistElement(position)
  }

  getNextPlaylistElement (position?: number): VideoPlaylistElement {
    if (!position) position = this.currentPlaylistElement.position + 1

    if (position > this.playlist.videosLength) {
      return undefined
    }

    const next = this.playlistElements.find(e => e.position === position)

    if (!next?.video) {
      return this.getNextPlaylistElement(position + 1)
    }

    return next
  }

  hasPreviousPlaylistElement (position?: number) {
    return !!this.getPreviousPlaylistElement(position)
  }

  getPreviousPlaylistElement (position?: number): VideoPlaylistElement {
    if (!position) position = this.currentPlaylistElement.position - 1

    if (position < 1) {
      return undefined
    }

    const prev = this.playlistElements.find(e => e.position === position)

    if (!prev?.video) {
      return this.getNextPlaylistElement(position - 1)
    }

    return prev
  }

  nextVideoTitle () {
    const next = this.getNextPlaylistElement()
    if (!next) return ''

    return next.video.name
  }

  setPosition (position: number) {
    this.currentPlaylistElement = this.playlistElements.find(e => e.position === position)
    if (!this.currentPlaylistElement?.video) {
      logger.error('Current playlist element is not valid.', this.currentPlaylistElement)
      this.currentPlaylistElement = this.getNextPlaylistElement()
    }

    if (!this.currentPlaylistElement) {
      throw new Error('This playlist does not have any valid element')
    }
  }

  setCurrentElement (playlistElement: VideoPlaylistElement) {
    this.currentPlaylistElement = playlistElement
  }

  getCurrentElement () {
    return this.currentPlaylistElement
  }

  getCurrentPosition () {
    if (!this.currentPlaylistElement) return -1

    return this.currentPlaylistElement.position
  }
}
