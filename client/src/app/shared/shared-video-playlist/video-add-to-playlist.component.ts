import * as debug from 'debug'
import { Subject, Subscription } from 'rxjs'
import { debounceTime, filter } from 'rxjs/operators'
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core'
import { AuthService, DisableForReuseHook, Notifier } from '@app/core'
import { FormReactive, FormValidatorService, VideoPlaylistValidatorsService } from '@app/shared/shared-forms'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { Video, VideoExistInPlaylist, VideoPlaylistCreate, VideoPlaylistElementCreate, VideoPlaylistPrivacy } from '@shared/models'
import { secondsToTime } from '../../../assets/player/utils'
import { CachedPlaylist, VideoPlaylistService } from './video-playlist.service'

const logger = debug('peertube:playlists:VideoAddToPlaylistComponent')

type PlaylistSummary = {
  id: number
  inPlaylist: boolean
  displayName: string

  playlistElementId?: number
  startTimestamp?: number
  stopTimestamp?: number
}

@Component({
  selector: 'my-video-add-to-playlist',
  styleUrls: [ './video-add-to-playlist.component.scss' ],
  templateUrl: './video-add-to-playlist.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VideoAddToPlaylistComponent extends FormReactive implements OnInit, OnChanges, OnDestroy, DisableForReuseHook {
  @Input() video: Video
  @Input() currentVideoTimestamp: number
  @Input() lazyLoad = false

  isNewPlaylistBlockOpened = false
  videoPlaylistSearch: string
  videoPlaylistSearchChanged = new Subject<string>()
  videoPlaylists: PlaylistSummary[] = []
  timestampOptions: {
    startTimestampEnabled: boolean
    startTimestamp: number
    stopTimestampEnabled: boolean
    stopTimestamp: number
  }
  displayOptions = false

  private disabled = false

  private listenToPlaylistChangeSub: Subscription
  private playlistsData: CachedPlaylist[] = []

  constructor (
    protected formValidatorService: FormValidatorService,
    private authService: AuthService,
    private notifier: Notifier,
    private i18n: I18n,
    private videoPlaylistService: VideoPlaylistService,
    private videoPlaylistValidatorsService: VideoPlaylistValidatorsService,
    private cd: ChangeDetectorRef
  ) {
    super()
  }

  get user () {
    return this.authService.getUser()
  }

  ngOnInit () {
    this.buildForm({
      displayName: this.videoPlaylistValidatorsService.VIDEO_PLAYLIST_DISPLAY_NAME
    })

    this.videoPlaylistService.listenToMyAccountPlaylistsChange()
        .subscribe(result => {
          this.playlistsData = result.data

          this.videoPlaylistService.runPlaylistCheck(this.video.id)
        })

    this.videoPlaylistSearchChanged
        .pipe(debounceTime(500))
        .subscribe(() => this.load())

    if (this.lazyLoad === false) this.load()
  }

  ngOnChanges (simpleChanges: SimpleChanges) {
    if (simpleChanges['video']) {
      this.reload()
    }
  }

  ngOnDestroy () {
    this.unsubscribePlaylistChanges()
  }

  disableForReuse () {
    this.disabled = true
  }

  enabledForReuse () {
    this.disabled = false
  }

  reload () {
    logger('Reloading component')

    this.videoPlaylists = []
    this.videoPlaylistSearch = undefined

    this.resetOptions(true)
    this.load()

    this.cd.markForCheck()
  }

  load () {
    logger('Loading component')

    this.listenToPlaylistChanges()

    this.videoPlaylistService.listMyPlaylistWithCache(this.user, this.videoPlaylistSearch)
        .subscribe(playlistsResult => {
          this.playlistsData = playlistsResult.data

          this.videoPlaylistService.runPlaylistCheck(this.video.id)
        })
  }

  openChange (opened: boolean) {
    if (opened === false) {
      this.isNewPlaylistBlockOpened = false
      this.displayOptions = false
    }
  }

  openCreateBlock (event: Event) {
    event.preventDefault()

    this.isNewPlaylistBlockOpened = true
  }

  togglePlaylist (event: Event, playlist: PlaylistSummary) {
    event.preventDefault()

    if (playlist.inPlaylist === true) {
      this.removeVideoFromPlaylist(playlist)
    } else {
      this.addVideoInPlaylist(playlist)
    }

    playlist.inPlaylist = !playlist.inPlaylist
    this.resetOptions()

    this.cd.markForCheck()
  }

  createPlaylist () {
    const displayName = this.form.value[ 'displayName' ]

    const videoPlaylistCreate: VideoPlaylistCreate = {
      displayName,
      privacy: VideoPlaylistPrivacy.PRIVATE
    }

    this.videoPlaylistService.createVideoPlaylist(videoPlaylistCreate).subscribe(
      () => {
        this.isNewPlaylistBlockOpened = false

        this.cd.markForCheck()
      },

      err => this.notifier.error(err.message)
    )
  }

  resetOptions (resetTimestamp = false) {
    this.displayOptions = false

    this.timestampOptions = {} as any
    this.timestampOptions.startTimestampEnabled = false
    this.timestampOptions.stopTimestampEnabled = false

    if (resetTimestamp) {
      this.timestampOptions.startTimestamp = 0
      this.timestampOptions.stopTimestamp = this.video.duration
    }
  }

  formatTimestamp (playlist: PlaylistSummary) {
    const start = playlist.startTimestamp ? secondsToTime(playlist.startTimestamp) : ''
    const stop = playlist.stopTimestamp ? secondsToTime(playlist.stopTimestamp) : ''

    return `(${start}-${stop})`
  }

  onVideoPlaylistSearchChanged () {
    this.videoPlaylistSearchChanged.next()
  }

  private removeVideoFromPlaylist (playlist: PlaylistSummary) {
    if (!playlist.playlistElementId) return

    this.videoPlaylistService.removeVideoFromPlaylist(playlist.id, playlist.playlistElementId, this.video.id)
        .subscribe(
          () => {
            this.notifier.success(this.i18n('Video removed from {{name}}', { name: playlist.displayName }))
          },

          err => {
            this.notifier.error(err.message)
          },

          () => this.cd.markForCheck()
        )
  }

  private listenToPlaylistChanges () {
    this.unsubscribePlaylistChanges()

    this.listenToPlaylistChangeSub = this.videoPlaylistService.listenToVideoPlaylistChange(this.video.id)
                                         .pipe(filter(() => this.disabled === false))
                                         .subscribe(existResult => this.rebuildPlaylists(existResult))
  }

  private unsubscribePlaylistChanges () {
    if (this.listenToPlaylistChangeSub) {
      this.listenToPlaylistChangeSub.unsubscribe()
      this.listenToPlaylistChangeSub = undefined
    }
  }

  private rebuildPlaylists (existResult: VideoExistInPlaylist[]) {
    logger('Got existing results for %d.', this.video.id, existResult)

    this.videoPlaylists = []
    for (const playlist of this.playlistsData) {
      const existingPlaylist = existResult.find(p => p.playlistId === playlist.id)

      this.videoPlaylists.push({
        id: playlist.id,
        displayName: playlist.displayName,
        inPlaylist: !!existingPlaylist,
        playlistElementId: existingPlaylist ? existingPlaylist.playlistElementId : undefined,
        startTimestamp: existingPlaylist ? existingPlaylist.startTimestamp : undefined,
        stopTimestamp: existingPlaylist ? existingPlaylist.stopTimestamp : undefined
      })
    }

    logger('Rebuilt playlist state for video %d.', this.video.id, this.videoPlaylists)

    this.cd.markForCheck()
  }

  private addVideoInPlaylist (playlist: PlaylistSummary) {
    const body: VideoPlaylistElementCreate = { videoId: this.video.id }

    if (this.timestampOptions.startTimestampEnabled) body.startTimestamp = this.timestampOptions.startTimestamp
    if (this.timestampOptions.stopTimestampEnabled) body.stopTimestamp = this.timestampOptions.stopTimestamp

    this.videoPlaylistService.addVideoInPlaylist(playlist.id, body)
      .subscribe(
        () => {
          const message = body.startTimestamp || body.stopTimestamp
            ? this.i18n('Video added in {{n}} at timestamps {{t}}', { n: playlist.displayName, t: this.formatTimestamp(playlist) })
            : this.i18n('Video added in {{n}}', { n: playlist.displayName })

          this.notifier.success(message)
        },

        err => {
          this.notifier.error(err.message)
        },

        () => this.cd.markForCheck()
      )
  }
}
