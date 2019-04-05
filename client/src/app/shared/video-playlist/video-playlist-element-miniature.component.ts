import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, Output, ViewChild } from '@angular/core'
import { Video } from '@app/shared/video/video.model'
import { VideoPlaylistElementUpdate } from '@shared/models'
import { AuthService, ConfirmService, Notifier, ServerService } from '@app/core'
import { ActivatedRoute } from '@angular/router'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { VideoService } from '@app/shared/video/video.service'
import { VideoPlaylistService } from '@app/shared/video-playlist/video-playlist.service'
import { NgbDropdown } from '@ng-bootstrap/ng-bootstrap'
import { VideoPlaylist } from '@app/shared/video-playlist/video-playlist.model'
import { secondsToTime } from '../../../assets/player/utils'

@Component({
  selector: 'my-video-playlist-element-miniature',
  styleUrls: [ './video-playlist-element-miniature.component.scss' ],
  templateUrl: './video-playlist-element-miniature.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VideoPlaylistElementMiniatureComponent {
  @ViewChild('moreDropdown') moreDropdown: NgbDropdown

  @Input() playlist: VideoPlaylist
  @Input() video: Video
  @Input() owned = false
  @Input() playing = false
  @Input() rowLink = false
  @Input() accountLink = true
  @Input() position: number

  @Output() elementRemoved = new EventEmitter<Video>()

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

  buildRouterLink () {
    if (!this.playlist) return null

    return [ '/videos/watch/playlist', this.playlist.uuid ]
  }

  buildRouterQuery () {
    if (!this.video) return {}

    return {
      videoId: this.video.uuid,
      start: this.video.playlistElement.startTimestamp,
      stop: this.video.playlistElement.stopTimestamp
    }
  }

  isVideoBlur (video: Video) {
    return video.isVideoNSFWForUser(this.authService.getUser(), this.serverService.getConfig())
  }

  removeFromPlaylist (video: Video) {
    this.videoPlaylistService.removeVideoFromPlaylist(this.playlist.id, video.id)
        .subscribe(
          () => {
            this.notifier.success(this.i18n('Video removed from {{name}}', { name: this.playlist.displayName }))

            this.elementRemoved.emit(this.video)
          },

          err => this.notifier.error(err.message)
        )

    this.moreDropdown.close()
  }

  updateTimestamps (video: Video) {
    const body: VideoPlaylistElementUpdate = {}

    body.startTimestamp = this.timestampOptions.startTimestampEnabled ? this.timestampOptions.startTimestamp : null
    body.stopTimestamp = this.timestampOptions.stopTimestampEnabled ? this.timestampOptions.stopTimestamp : null

    this.videoPlaylistService.updateVideoOfPlaylist(this.playlist.id, video.id, body)
        .subscribe(
          () => {
            this.notifier.success(this.i18n('Timestamps updated'))

            video.playlistElement.startTimestamp = body.startTimestamp
            video.playlistElement.stopTimestamp = body.stopTimestamp

            this.cdr.detectChanges()
          },

          err => this.notifier.error(err.message)
        )

    this.moreDropdown.close()
  }

  formatTimestamp (video: Video) {
    const start = video.playlistElement.startTimestamp
    const stop = video.playlistElement.stopTimestamp

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

  toggleDisplayTimestampsOptions (event: Event, video: Video) {
    event.preventDefault()

    this.displayTimestampOptions = !this.displayTimestampOptions

    if (this.displayTimestampOptions === true) {
      this.timestampOptions = {
        startTimestampEnabled: false,
        stopTimestampEnabled: false,
        startTimestamp: 0,
        stopTimestamp: video.duration
      }

      if (video.playlistElement.startTimestamp) {
        this.timestampOptions.startTimestampEnabled = true
        this.timestampOptions.startTimestamp = video.playlistElement.startTimestamp
      }

      if (video.playlistElement.stopTimestamp) {
        this.timestampOptions.stopTimestampEnabled = true
        this.timestampOptions.stopTimestamp = video.playlistElement.stopTimestamp
      }
    }

    // FIXME: why do we have to use setTimeout here?
    setTimeout(() => {
      this.cdr.detectChanges()
    })
  }
}
