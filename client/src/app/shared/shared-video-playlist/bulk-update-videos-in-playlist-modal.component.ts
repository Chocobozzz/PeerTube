import { Component, ElementRef, inject, OnDestroy, OnInit, output, viewChild, ChangeDetectionStrategy } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { AuthService, Notifier } from '@app/core'
import { formatICU } from '@app/helpers'
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap/modal'
import { uniqify } from '@peertube/peertube-core-utils'
import { Video, VideoPlaylistElementCreate, VideosExistInPlaylists } from '@peertube/peertube-models'
import debug from 'debug'
import { concat, Observable, of, Subject, Subscription } from 'rxjs'
import { catchError, debounceTime, map, switchMap } from 'rxjs/operators'
import { PeertubeCheckboxComponent } from '../shared-forms/peertube-checkbox.component'
import { GlobalIconComponent } from '../shared-icons/global-icon.component'
import { ButtonComponent } from '../shared-main/buttons/button.component'
import { CollaboratorStateComponent } from '../shared-main/channel/collaborator-state.component'
import { PlaylistCreateBlockComponent } from './shared/playlist-create-block.component'
import { CachedPlaylist, VideoPlaylistService } from './video-playlist.service'

const debugLogger = debug('peertube:playlists:BulkUpdateVideosInPlaylistModalComponent')

type PlaylistElement = {
  playlistElementId: number
  videoId: number
}

@Component({
  selector: 'my-bulk-update-videos-in-playlist-modal',
  styleUrls: [ './bulk-update-videos-in-playlist-modal.component.scss' ],
  templateUrl: './bulk-update-videos-in-playlist-modal.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    FormsModule,
    PeertubeCheckboxComponent,
    GlobalIconComponent,
    CollaboratorStateComponent,
    ButtonComponent,
    PlaylistCreateBlockComponent
  ]
})
export class BulkUpdateVideosInPlaylistModalComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService)
  private notifier = inject(Notifier)
  private videoPlaylistService = inject(VideoPlaylistService)
  private modalService = inject(NgbModal)

  readonly saved = output<Video[]>()

  videos: Video[]

  videoPlaylistSearch: string
  videoPlaylistSearchChanged = new Subject<void>()

  // playlistId => playlist
  seenPlaylists: Record<number, CachedPlaylist> = {}
  currentPlaylists: CachedPlaylist[] = []

  elementsPerPlaylist: Record<number, PlaylistElement[]> = {}

  playlistsEnabled: Record<number, boolean> = {}
  initialPlaylistsEnabled: Record<number, boolean> = {}

  isNewPlaylistBlockOpened = false
  updatingPlaylists = false

  readonly modal = viewChild<ElementRef>('modal')

  private openedModal: NgbModalRef
  private videosContainedInPlaylists: VideosExistInPlaylists

  private listenToAccountPlaylistsChangeSub: Subscription

  get user () {
    return this.authService.getUser()
  }

  get videoIds () {
    return this.videos.map(video => video.id)
  }

  ngOnInit () {
    this.videoPlaylistService.listMyPlaylistWithCache(this.user, this.videoPlaylistSearch)
      .subscribe(playlistsResult => this.currentPlaylists = playlistsResult.data)

    this.listenToAccountPlaylistsChangeSub = this.videoPlaylistService.listenToMyAccountPlaylistsChange()
      .subscribe(result => {
        this.currentPlaylists = result.data

        this.rebuildPlaylists()
      })

    this.videoPlaylistSearchChanged
      .pipe(
        debounceTime(500),
        switchMap(() => this.videoPlaylistService.listMyPlaylistWithCache(this.user, this.videoPlaylistSearch))
      ).subscribe(({ data }) => {
        this.currentPlaylists = data

        this.rebuildPlaylists()
      })
  }

  ngOnDestroy () {
    this.listenToAccountPlaylistsChangeSub?.unsubscribe()
  }

  show (options: {
    videos: Video[]
    videosContainedInPlaylists: VideosExistInPlaylists
  }) {
    this.videos = options.videos
    this.videosContainedInPlaylists = options.videosContainedInPlaylists

    this.elementsPerPlaylist = {}

    this.playlistsEnabled = {}
    this.initialPlaylistsEnabled = {}

    this.isNewPlaylistBlockOpened = false

    this.rebuildPlaylists()

    this.openedModal = this.modalService.open(this.modal(), { centered: true, keyboard: false })
  }

  hide () {
    this.openedModal.close()
  }

  private rebuildPlaylists () {
    if (!this.videosContainedInPlaylists) return

    for (const playlist of this.currentPlaylists) {
      this.elementsPerPlaylist[playlist.id] = []
      this.seenPlaylists[playlist.id] = playlist
    }

    // Populate videoId elements per playlist based on the videosContainedInPlaylists result
    for (const [ videoId, videoExistInPlaylist ] of Object.entries(this.videosContainedInPlaylists)) {
      for (const element of videoExistInPlaylist) {
        // Not one of the displayed playlists, move on
        if (!this.elementsPerPlaylist[element.playlistId]) continue

        this.elementsPerPlaylist[element.playlistId].push({
          videoId: +videoId,
          playlistElementId: element.playlistElementId
        })
      }
    }

    // Determine for which playlists all videos are already in, and enable those
    for (const [ playlistIdStr, elements ] of Object.entries(this.elementsPerPlaylist)) {
      const playlistId = +playlistIdStr

      if (this.playlistsEnabled[playlistId] !== undefined) continue

      this.playlistsEnabled[playlistId] = uniqify(elements.map(e => e.videoId)).length === this.videoIds.length
      this.initialPlaylistsEnabled[playlistId] = this.playlistsEnabled[playlistId]
    }

    debugLogger('Rebuilt playlists, enabled playlists:', this.playlistsEnabled)
  }

  onVideoPlaylistSearchChanged () {
    this.videoPlaylistSearchChanged.next()
  }

  getPrimaryInputName (playlist: CachedPlaylist) {
    return 'videos-update-playlist-' + playlist.id
  }

  // ---------------------------------------------------------------------------

  save () {
    const observableList: Observable<{ type: 'success' | 'error', message: string }>[] = []
    this.updatingPlaylists = true

    for (const [ playlistIdStr, enabled ] of Object.entries(this.playlistsEnabled)) {
      const playlistId = +playlistIdStr

      const playlist = this.seenPlaylists[playlistId]

      const isEnabledInitially = this.initialPlaylistsEnabled[playlistId]

      if (enabled && !isEnabledInitially) {
        observableList.push(this.addVideosInPlaylist(playlist))
      } else if (!enabled && isEnabledInitially) {
        observableList.push(this.removeVideosFromPlaylist(playlist))
      }
    }

    if (observableList.length === 0) {
      this.updatingPlaylists = false
      this.notifier.info($localize`No change to save`)
      this.hide()
      return
    }

    concat(...observableList)
      .subscribe({
        next: result => {
          if (result.type === 'success') {
            this.notifier.success(result.message)
          } else {
            this.notifier.error(result.message)
          }
        },

        error: err => this.notifier.handleError(err),

        complete: () => {
          this.updatingPlaylists = false
          this.hide()
          this.saved.emit(this.videos)
        }
      })
  }

  private addVideosInPlaylist (playlist: CachedPlaylist) {
    const existing = new Set(this.elementsPerPlaylist[playlist.id].map(e => e.videoId))
    const body: VideoPlaylistElementCreate[] = this.videos
      .filter(v => !existing.has(v.id))
      .map(v => ({ videoId: v.id }))

    return this.videoPlaylistService.addVideoInPlaylist(playlist.id, body)
      .pipe(
        map(results => {
          return {
            type: 'success' as const,
            message: formatICU(
              $localize`{count, plural, =1 {Video added} other {{count} videos added}} to {playlistName}`,
              { count: results.length, playlistName: playlist.displayName }
            )
          }
        }),
        catchError(err => of({ type: 'error' as const, message: err.message }))
      )
  }

  private removeVideosFromPlaylist (playlist: CachedPlaylist) {
    return this.videoPlaylistService.removeElementsFromPlaylist({
      playlistId: playlist.id,
      elements: this.elementsPerPlaylist[playlist.id].map(element => ({
        playlistElementId: element.playlistElementId,
        videoId: element.videoId
      }))
    }).pipe(
      map(results => {
        return {
          type: 'success' as const,
          message: formatICU(
            $localize`{count, plural, =1 {Video removed} other {{count} videos removed}} from {playlistName}`,
            { count: results.length, playlistName: playlist.displayName }
          )
        }
      }),
      catchError(err => of({ type: 'error' as const, message: err.message }))
    )
  }

  // ---------------------------------------------------------------------------

  onPlaylistCreated () {
    this.isNewPlaylistBlockOpened = false
    this.rebuildPlaylists()
  }
}
