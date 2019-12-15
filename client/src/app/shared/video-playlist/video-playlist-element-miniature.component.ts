import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, Output, ViewChild } from '@angular/core'
import { Video } from '@app/shared/video/video.model'
import { VideoPlaylistElementType, VideoPlaylistElementUpdate } from '@shared/models'
import { AuthService, ConfirmService, Notifier, ServerService } from '@app/core'
import { ActivatedRoute } from '@angular/router'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { VideoService } from '@app/shared/video/video.service'
import { VideoPlaylistService } from '@app/shared/video-playlist/video-playlist.service'
import { NgbDropdown } from '@ng-bootstrap/ng-bootstrap'
import { VideoPlaylist } from '@app/shared/video-playlist/video-playlist.model'
import { secondsToTime } from '../../../assets/player/utils'
import { VideoPlaylistElement } from '@app/shared/video-playlist/video-playlist-element.model'

@Component({
  selector: 'my-video-playlist-element-miniature',
  styleUrls: [ './video-playlist-element-miniature.component.scss' ],
  templateUrl: './video-playlist-element-miniature.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VideoPlaylistElementMiniatureComponent {
  @ViewChild('moreDropdown', { static: false }) moreDropdown: NgbDropdown

  @Input() playlist: VideoPlaylist
  @Input() playlistElement: VideoPlaylistElement
  @Input() owned = false
  @Input() playing = false
  @Input() rowLink = false
  @Input() accountLink = true
  @Input() position: number // Keep this property because we're in the OnPush change detection strategy

  @Output() elementRemoved = new EventEmitter<VideoPlaylistElement>()

  displayTimestampOptions = false

  timestampOptions: {
    startTimestampEnabled: boolean
    startTimestamp: number
    stopTimestampEnabled: boolean
    stopTimestamp: number
  } = {} as any

  constructor (
    private authService: AuthService,
    private serverService: ServerService,
    private notifier: Notifier,
    private confirmService: ConfirmService,
    private route: ActivatedRoute,
    private i18n: I18n,
    private videoService: VideoService,
    private videoPlaylistService: VideoPlaylistService,
    private cdr: ChangeDetectorRef
  ) {}

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
      stop: this.playlistElement.stopTimestamp
    }
  }

  isVideoBlur (video: Video) {
    return video.isVideoNSFWForUser(this.authService.getUser(), this.serverService.getConfig())
  }

  removeFromPlaylist (playlistElement: VideoPlaylistElement) {
    this.videoPlaylistService.removeVideoFromPlaylist(this.playlist.id, playlistElement.id)
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

    this.videoPlaylistService.updateVideoOfPlaylist(this.playlist.id, playlistElement.id, body)
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
