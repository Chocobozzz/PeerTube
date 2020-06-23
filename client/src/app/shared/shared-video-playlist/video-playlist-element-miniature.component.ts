import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core'
import { AuthService, Notifier, ServerService } from '@app/core'
import { Video } from '@app/shared/shared-main'
import { NgbDropdown } from '@ng-bootstrap/ng-bootstrap'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { ServerConfig, VideoPlaylistElementType, VideoPlaylistElementUpdate } from '@shared/models'
import { secondsToTime } from '../../../assets/player/utils'
import { VideoPlaylistElement } from './video-playlist-element.model'
import { VideoPlaylist } from './video-playlist.model'
import { VideoPlaylistService } from './video-playlist.service'

@Component({
  selector: 'my-video-playlist-element-miniature',
  styleUrls: [ './video-playlist-element-miniature.component.scss' ],
  templateUrl: './video-playlist-element-miniature.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VideoPlaylistElementMiniatureComponent implements OnInit {
  @ViewChild('moreDropdown') moreDropdown: NgbDropdown

  @Input() playlist: VideoPlaylist
  @Input() playlistElement: VideoPlaylistElement
  @Input() owned = false
  @Input() playing = false
  @Input() rowLink = false
  @Input() accountLink = true
  @Input() position: number // Keep this property because we're in the OnPush change detection strategy
  @Input() touchScreenEditButton = false

  @Output() elementRemoved = new EventEmitter<VideoPlaylistElement>()

  displayTimestampOptions = false

  timestampOptions: {
    startTimestampEnabled: boolean
    startTimestamp: number
    stopTimestampEnabled: boolean
    stopTimestamp: number
  } = {} as any

  private serverConfig: ServerConfig

  constructor (
    private authService: AuthService,
    private serverService: ServerService,
    private notifier: Notifier,
    private i18n: I18n,
    private videoPlaylistService: VideoPlaylistService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit (): void {
    this.serverConfig = this.serverService.getTmpConfig()
    this.serverService.getConfig()
        .subscribe(config => {
          this.serverConfig = config
          this.cdr.detectChanges()
        })
  }

  isUnavailable (e: VideoPlaylistElement) {
    return e.type === VideoPlaylistElementType.UNAVAILABLE
  }

  isPrivate (e: VideoPlaylistElement) {
    return e.type === VideoPlaylistElementType.PRIVATE
  }

  isDeleted (e: VideoPlaylistElement) {
    return e.type === VideoPlaylistElementType.DELETED
  }

  buildRouterLink () {
    if (!this.playlist) return null

    return [ '/videos/watch/playlist', this.playlist.uuid ]
  }

  buildRouterQuery () {
    if (!this.playlistElement || !this.playlistElement.video) return {}

    return {
      videoId: this.playlistElement.video.uuid,
      start: this.playlistElement.startTimestamp,
      stop: this.playlistElement.stopTimestamp,
      resume: true
    }
  }

  isVideoBlur (video: Video) {
    return video.isVideoNSFWForUser(this.authService.getUser(), this.serverConfig)
  }

  removeFromPlaylist (playlistElement: VideoPlaylistElement) {
    const videoId = this.playlistElement.video ? this.playlistElement.video.id : undefined

    this.videoPlaylistService.removeVideoFromPlaylist(this.playlist.id, playlistElement.id, videoId)
        .subscribe(
          () => {
            this.notifier.success(this.i18n('Video removed from {{name}}', { name: this.playlist.displayName }))

            this.elementRemoved.emit(playlistElement)
          },

          err => this.notifier.error(err.message)
        )

    this.moreDropdown.close()
  }

  updateTimestamps (playlistElement: VideoPlaylistElement) {
    const body: VideoPlaylistElementUpdate = {}

    body.startTimestamp = this.timestampOptions.startTimestampEnabled ? this.timestampOptions.startTimestamp : null
    body.stopTimestamp = this.timestampOptions.stopTimestampEnabled ? this.timestampOptions.stopTimestamp : null

    this.videoPlaylistService.updateVideoOfPlaylist(this.playlist.id, playlistElement.id, body, this.playlistElement.video.id)
        .subscribe(
          () => {
            this.notifier.success(this.i18n('Timestamps updated'))

            playlistElement.startTimestamp = body.startTimestamp
            playlistElement.stopTimestamp = body.stopTimestamp

            this.cdr.detectChanges()
          },

          err => this.notifier.error(err.message)
        )

    this.moreDropdown.close()
  }

  formatTimestamp (playlistElement: VideoPlaylistElement) {
    const start = playlistElement.startTimestamp
    const stop = playlistElement.stopTimestamp

    const startFormatted = secondsToTime(start, true, ':')
    const stopFormatted = secondsToTime(stop, true, ':')

    if (start === null && stop === null) return ''

    if (start !== null && stop === null) return this.i18n('Starts at ') + startFormatted
    if (start === null && stop !== null) return this.i18n('Stops at ') + stopFormatted

    return this.i18n('Starts at ') + startFormatted + this.i18n(' and stops at ') + stopFormatted
  }

  onDropdownOpenChange () {
    this.displayTimestampOptions = false
  }

  toggleDisplayTimestampsOptions (event: Event, playlistElement: VideoPlaylistElement) {
    event.preventDefault()

    this.displayTimestampOptions = !this.displayTimestampOptions

    if (this.displayTimestampOptions === true) {
      this.timestampOptions = {
        startTimestampEnabled: false,
        stopTimestampEnabled: false,
        startTimestamp: 0,
        stopTimestamp: playlistElement.video.duration
      }

      if (playlistElement.startTimestamp) {
        this.timestampOptions.startTimestampEnabled = true
        this.timestampOptions.startTimestamp = playlistElement.startTimestamp
      }

      if (playlistElement.stopTimestamp) {
        this.timestampOptions.stopTimestampEnabled = true
        this.timestampOptions.stopTimestamp = playlistElement.stopTimestamp
      }
    }

    // FIXME: why do we have to use setTimeout here?
    setTimeout(() => {
      this.cdr.detectChanges()
    })
  }
}
