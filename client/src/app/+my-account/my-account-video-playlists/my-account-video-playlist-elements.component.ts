import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core'
import { Notifier, ServerService } from '@app/core'
import { AuthService } from '../../core/auth'
import { ConfirmService } from '../../core/confirm'
import { ComponentPagination } from '@app/shared/rest/component-pagination.model'
import { Video } from '@app/shared/video/video.model'
import { Subscription } from 'rxjs'
import { ActivatedRoute } from '@angular/router'
import { VideoService } from '@app/shared/video/video.service'
import { VideoPlaylistService } from '@app/shared/video-playlist/video-playlist.service'
import { VideoPlaylist } from '@app/shared/video-playlist/video-playlist.model'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { secondsToTime } from '../../../assets/player/utils'
import { VideoPlaylistElementUpdate } from '@shared/models'
import { NgbDropdown } from '@ng-bootstrap/ng-bootstrap'

@Component({
  selector: 'my-account-video-playlist-elements',
  templateUrl: './my-account-video-playlist-elements.component.html',
  styleUrls: [ './my-account-video-playlist-elements.component.scss' ]
})
export class MyAccountVideoPlaylistElementsComponent implements OnInit, OnDestroy {
  @ViewChild('moreDropdown') moreDropdown: NgbDropdown

  videos: Video[] = []
  playlist: VideoPlaylist

  pagination: ComponentPagination = {
    currentPage: 1,
    itemsPerPage: 10,
    totalItems: null
  }

  displayTimestampOptions = false

  timestampOptions: {
    startTimestampEnabled: boolean
    startTimestamp: number
    stopTimestampEnabled: boolean
    stopTimestamp: number
  } = {} as any

  private videoPlaylistId: string | number
  private paramsSub: Subscription

  constructor (
    private authService: AuthService,
    private serverService: ServerService,
    private notifier: Notifier,
    private confirmService: ConfirmService,
    private route: ActivatedRoute,
    private i18n: I18n,
    private videoService: VideoService,
    private videoPlaylistService: VideoPlaylistService
  ) {}

  ngOnInit () {
    this.paramsSub = this.route.params.subscribe(routeParams => {
      this.videoPlaylistId = routeParams[ 'videoPlaylistId' ]
      this.loadElements()

      this.loadPlaylistInfo()
    })
  }

  ngOnDestroy () {
    if (this.paramsSub) this.paramsSub.unsubscribe()
  }

  isVideoBlur (video: Video) {
    return video.isVideoNSFWForUser(this.authService.getUser(), this.serverService.getConfig())
  }

  removeFromPlaylist (video: Video) {
    this.videoPlaylistService.removeVideoFromPlaylist(this.playlist.id, video.id)
        .subscribe(
          () => {
            this.notifier.success(this.i18n('Video removed from {{name}}', { name: this.playlist.displayName }))

            this.videos = this.videos.filter(v => v.id !== video.id)
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
          },

          err => this.notifier.error(err.message)
        )

    this.moreDropdown.close()
  }

  onNearOfBottom () {
    // Last page
    if (this.pagination.totalItems <= (this.pagination.currentPage * this.pagination.itemsPerPage)) return

    this.pagination.currentPage += 1
    this.loadElements()
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
  }

  private loadElements () {
    this.videoService.getPlaylistVideos(this.videoPlaylistId, this.pagination)
        .subscribe(({ totalVideos, videos }) => {
          this.videos = this.videos.concat(videos)
          this.pagination.totalItems = totalVideos
        })
  }

  private loadPlaylistInfo () {
    this.videoPlaylistService.getVideoPlaylist(this.videoPlaylistId)
      .subscribe(playlist => {
        this.playlist = playlist
      })
  }
}
