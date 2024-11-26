import debug from 'debug'
import { Subject, Subscription } from 'rxjs'
import { debounceTime, filter } from 'rxjs/operators'
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core'
import { AuthService, DisableForReuseHook, Notifier } from '@app/core'
import { secondsToTime } from '@peertube/peertube-core-utils'
import {
  CachedVideoExistInPlaylist,
  Video,
  VideoPlaylistCreate,
  VideoPlaylistElementCreate,
  VideoPlaylistElementUpdate,
  VideoPlaylistPrivacy
} from '@peertube/peertube-models'
import { VIDEO_PLAYLIST_DISPLAY_NAME_VALIDATOR } from '../form-validators/video-playlist-validators'
import { CachedPlaylist, VideoPlaylistService } from './video-playlist.service'
import { TimestampInputComponent } from '../shared-forms/timestamp-input.component'
import { GlobalIconComponent } from '../shared-icons/global-icon.component'
import { PeertubeCheckboxComponent } from '../shared-forms/peertube-checkbox.component'
import { NgFor, NgClass, NgIf } from '@angular/common'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { FormReactive } from '@app/shared/shared-forms/form-reactive'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'

const debugLogger = debug('peertube:playlists:VideoAddToPlaylistComponent')

type PlaylistElement = {
  enabled: boolean
  playlistElementId?: number
  startTimestamp?: number
  stopTimestamp?: number
}

type PlaylistSummary = {
  id: number
  displayName: string
  optionalRowDisplayed: boolean

  elements: PlaylistElement[]
}

@Component({
  selector: 'my-video-add-to-playlist',
  styleUrls: [ './video-add-to-playlist.component.scss' ],
  templateUrl: './video-add-to-playlist.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    FormsModule,
    NgFor,
    NgClass,
    PeertubeCheckboxComponent,
    GlobalIconComponent,
    NgIf,
    TimestampInputComponent,
    ReactiveFormsModule
  ]
})
export class VideoAddToPlaylistComponent extends FormReactive implements OnInit, OnChanges, OnDestroy, DisableForReuseHook {
  @Input() video: Video
  @Input() currentVideoTimestamp: number

  isNewPlaylistBlockOpened = false

  videoPlaylistSearch: string
  videoPlaylistSearchChanged = new Subject<void>()

  videoPlaylists: PlaylistSummary[] = []

  private disabled = false

  private listenToPlaylistChangeSub: Subscription
  private playlistsData: CachedPlaylist[] = []

  private pendingAddId: number

  constructor (
    protected formReactiveService: FormReactiveService,
    private authService: AuthService,
    private notifier: Notifier,
    private videoPlaylistService: VideoPlaylistService,
    private cd: ChangeDetectorRef
  ) {
    super()
  }

  get user () {
    return this.authService.getUser()
  }

  ngOnInit () {
    this.buildForm({
      displayName: VIDEO_PLAYLIST_DISPLAY_NAME_VALIDATOR
    })

    this.videoPlaylistService.listenToMyAccountPlaylistsChange()
        .subscribe(result => {
          this.playlistsData = result.data

          this.videoPlaylistService.runVideoExistsInPlaylistCheck(this.video.id)
        })

    this.videoPlaylistSearchChanged
        .pipe(debounceTime(500))
        .subscribe(() => this.load())
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
    debugLogger('Reloading component')

    this.videoPlaylists = []
    this.videoPlaylistSearch = undefined

    this.load()

    this.cd.markForCheck()
  }

  load () {
    debugLogger('Loading component')

    this.listenToVideoPlaylistChange()

    this.videoPlaylistService.listMyPlaylistWithCache(this.user, this.videoPlaylistSearch)
        .subscribe(playlistsResult => {
          this.playlistsData = playlistsResult.data

          this.videoPlaylistService.runVideoExistsInPlaylistCheck(this.video.id)
        })
  }

  openCreateBlock (event: Event) {
    event.preventDefault()

    this.isNewPlaylistBlockOpened = true
  }

  toggleMainPlaylist (e: Event, playlist: PlaylistSummary) {
    e.preventDefault()

    if (this.isPresentMultipleTimes(playlist) || playlist.optionalRowDisplayed) return

    if (playlist.elements.length === 0) {
      const element: PlaylistElement = {
        enabled: true,
        playlistElementId: undefined,
        startTimestamp: 0,
        stopTimestamp: this.video.duration
      }

      this.addVideoInPlaylist(playlist, element)
    } else {
      this.removeVideoFromPlaylist(playlist, playlist.elements[0].playlistElementId)
      playlist.elements = []
    }

    this.cd.markForCheck()
  }

  toggleOptionalPlaylist (e: Event, playlist: PlaylistSummary, element: PlaylistElement, startTimestamp: number, stopTimestamp: number) {
    e.preventDefault()

    if (element.enabled) {
      this.removeVideoFromPlaylist(playlist, element.playlistElementId)
      element.enabled = false

      // Hide optional rows pane when the user unchecked all the playlists
      if (this.isPrimaryCheckboxChecked(playlist) === false) {
        playlist.optionalRowDisplayed = false
      }
    } else {
      const element: PlaylistElement = {
        enabled: true,
        playlistElementId: undefined,
        startTimestamp,
        stopTimestamp
      }

      this.addVideoInPlaylist(playlist, element)
    }

    this.cd.markForCheck()
  }

  createPlaylist () {
    const displayName = this.form.value['displayName']

    const videoPlaylistCreate: VideoPlaylistCreate = {
      displayName,
      privacy: VideoPlaylistPrivacy.PRIVATE
    }

    this.videoPlaylistService.createVideoPlaylist(videoPlaylistCreate)
      .subscribe({
        next: () => {
          this.isNewPlaylistBlockOpened = false

          this.cd.markForCheck()
        },

        error: err => this.notifier.error(err.message)
      })
  }

  onVideoPlaylistSearchChanged () {
    this.videoPlaylistSearchChanged.next()
  }

  isPrimaryCheckboxChecked (playlist: PlaylistSummary) {
    // Reduce latency when adding a video to a playlist using pendingAddId
    return this.pendingAddId === playlist.id ||
      playlist.elements.filter(e => e.enabled).length !== 0
  }

  toggleOptionalRow (playlist: PlaylistSummary) {
    playlist.optionalRowDisplayed = !playlist.optionalRowDisplayed

    this.cd.markForCheck()
  }

  getPrimaryInputName (playlist: PlaylistSummary) {
    return 'in-playlist-primary-' + playlist.id
  }

  getOptionalInputName (playlist: PlaylistSummary, element?: PlaylistElement) {
    const suffix = element
      ? '-' + element.playlistElementId
      : ''

    return 'in-playlist-optional-' + playlist.id + suffix
  }

  buildOptionalRowElements (playlist: PlaylistSummary) {
    const elements = playlist.elements

    const lastElement = elements.length === 0
      ? undefined
      : elements[elements.length - 1]

    // Build an empty last element
    if (!lastElement || lastElement.enabled === true) {
      elements.push({
        enabled: false,
        startTimestamp: 0,
        stopTimestamp: this.video.duration
      })
    }

    return elements
  }

  isPresentMultipleTimes (playlist: PlaylistSummary) {
    return playlist.elements.filter(e => e.enabled === true).length > 1
  }

  onElementTimestampUpdate (playlist: PlaylistSummary, element: PlaylistElement) {
    if (!element.playlistElementId || element.enabled === false) return

    const body: VideoPlaylistElementUpdate = {
      startTimestamp: element.startTimestamp,
      stopTimestamp: element.stopTimestamp
    }

    this.videoPlaylistService.updateVideoOfPlaylist(playlist.id, element.playlistElementId, body, this.video.id)
        .subscribe({
          next: () => {
            this.notifier.success($localize`Timestamps updated`)
          },

          error: err => this.notifier.error(err.message),

          complete: () => this.cd.markForCheck()
        })
  }

  private isOptionalRowDisplayed (playlist: PlaylistSummary) {
    const elements = playlist.elements.filter(e => e.enabled)

    if (elements.length > 1) return true

    if (elements.length === 1) {
      const element = elements[0]

      if (
        (element.startTimestamp && element.startTimestamp !== 0) ||
        (element.stopTimestamp && element.stopTimestamp !== this.video.duration)
      ) {
        return true
      }
    }

    return false
  }

  private removeVideoFromPlaylist (playlist: PlaylistSummary, elementId: number) {
    this.videoPlaylistService.removeVideoFromPlaylist(playlist.id, elementId, this.video.id)
        .subscribe({
          next: () => {
            this.notifier.success($localize`Video removed from ${playlist.displayName}`)
          },

          error: err => this.notifier.error(err.message),

          complete: () => this.cd.markForCheck()
        })
  }

  private listenToVideoPlaylistChange () {
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

  private rebuildPlaylists (existResult: CachedVideoExistInPlaylist[]) {
    debugLogger('Got existing results for %d.', this.video.id, existResult)

    const oldPlaylists = this.videoPlaylists

    this.videoPlaylists = []
    for (const playlist of this.playlistsData) {
      const existingPlaylists = existResult.filter(p => p.playlistId === playlist.id)

      const playlistSummary = {
        id: playlist.id,
        optionalRowDisplayed: false,
        displayName: playlist.displayName,
        elements: existingPlaylists.map(e => ({
          enabled: true,
          playlistElementId: e.playlistElementId,
          startTimestamp: e.startTimestamp || 0,
          stopTimestamp: e.stopTimestamp || this.video.duration
        }))
      }

      const oldPlaylist = oldPlaylists.find(p => p.id === playlist.id)
      playlistSummary.optionalRowDisplayed = oldPlaylist
        ? oldPlaylist.optionalRowDisplayed
        : this.isOptionalRowDisplayed(playlistSummary)

      this.videoPlaylists.push(playlistSummary)
    }

    debugLogger('Rebuilt playlist state for video %d.', this.video.id, this.videoPlaylists)

    this.cd.markForCheck()
  }

  private addVideoInPlaylist (playlist: PlaylistSummary, element: PlaylistElement) {
    const body: VideoPlaylistElementCreate = { videoId: this.video.id }

    if (element.startTimestamp) body.startTimestamp = element.startTimestamp
    if (element.stopTimestamp && element.stopTimestamp !== this.video.duration) body.stopTimestamp = element.stopTimestamp

    this.pendingAddId = playlist.id

    this.videoPlaylistService.addVideoInPlaylist(playlist.id, body)
      .subscribe({
        next: res => {
          const message = body.startTimestamp || body.stopTimestamp
            ? $localize`Video added in ${playlist.displayName} at timestamps ${this.formatTimestamp(element)}`
            : $localize`Video added in ${playlist.displayName}`

          this.notifier.success(message)

          if (element) element.playlistElementId = res.videoPlaylistElement.id
        },

        error: err => {
          this.pendingAddId = undefined
          this.cd.markForCheck()

          this.notifier.error(err.message)
        },

        complete: () => {
          this.pendingAddId = undefined
          this.cd.markForCheck()
        }
      })
  }

  private formatTimestamp (element: PlaylistElement) {
    const start = element.startTimestamp ? secondsToTime(element.startTimestamp) : ''
    const stop = element.stopTimestamp ? secondsToTime(element.stopTimestamp) : ''

    return `(${start}-${stop})`
  }
}
