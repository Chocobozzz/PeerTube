import { uniqBy } from 'lodash-es'
import { concat, Observable } from 'rxjs'
import { tap, toArray } from 'rxjs/operators'
import { Component, OnInit, ViewChild } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { AuthService, ComponentPagination, ConfirmService, Notifier, ScreenService, ServerService, User } from '@app/core'
import { DisableForReuseHook } from '@app/core/routing/disable-for-reuse-hook'
import { immutableAssign, prepareIcu } from '@app/helpers'
import { AdvancedInputFilter } from '@app/shared/shared-forms'
import { DropdownAction, Video, VideoService } from '@app/shared/shared-main'
import { LiveStreamInformationComponent } from '@app/shared/shared-video-live'
import {
  MiniatureDisplayOptions,
  SelectionType,
  VideoActionsDisplayType,
  VideosSelectionComponent
} from '@app/shared/shared-video-miniature'
import { VideoPlaylistService } from '@app/shared/shared-video-playlist'
import { VideoChannel, VideoExistInPlaylist, VideosExistInPlaylists, VideoSortField } from '@shared/models'
import { VideoChangeOwnershipComponent } from './modals/video-change-ownership.component'

@Component({
  templateUrl: './my-videos.component.html',
  styleUrls: [ './my-videos.component.scss' ]
})
export class MyVideosComponent implements OnInit, DisableForReuseHook {
  @ViewChild('videosSelection', { static: true }) videosSelection: VideosSelectionComponent
  @ViewChild('videoChangeOwnershipModal', { static: true }) videoChangeOwnershipModal: VideoChangeOwnershipComponent
  @ViewChild('liveStreamInformationModal', { static: true }) liveStreamInformationModal: LiveStreamInformationComponent

  videosContainedInPlaylists: VideosExistInPlaylists = {}
  titlePage: string
  selection: SelectionType = {}
  pagination: ComponentPagination = {
    currentPage: 1,
    itemsPerPage: 10,
    totalItems: null
  }
  miniatureDisplayOptions: MiniatureDisplayOptions = {
    date: true,
    views: true,
    by: true,
    privacyLabel: false,
    privacyText: true,
    state: true,
    blacklistInfo: true,
    forceChannelInBy: true
  }
  videoDropdownDisplayOptions: VideoActionsDisplayType = {
    playlist: false,
    download: false,
    update: false,
    blacklist: false,
    delete: true,
    report: false,
    duplicate: false,
    mute: false,
    liveInfo: true,
    removeFiles: false,
    transcoding: false,
    studio: true,
    stats: true
  }

  moreVideoActions: DropdownAction<{ video: Video }>[][] = []

  videos: Video[] = []
  getVideosObservableFunction = this.getVideosObservable.bind(this)

  sort: VideoSortField = '-publishedAt'

  user: User

  inputFilters: AdvancedInputFilter[] = []

  disabled = false

  private search: string
  private userChannels: VideoChannel[] = []

  constructor (
    protected router: Router,
    protected serverService: ServerService,
    protected route: ActivatedRoute,
    protected authService: AuthService,
    protected notifier: Notifier,
    protected screenService: ScreenService,
    private confirmService: ConfirmService,
    private videoService: VideoService,
    private playlistService: VideoPlaylistService
  ) {
    this.titlePage = $localize`My videos`
  }

  ngOnInit () {
    this.buildActions()

    this.user = this.authService.getUser()

    if (this.route.snapshot.queryParams['search']) {
      this.search = this.route.snapshot.queryParams['search']
    }

    this.authService.userInformationLoaded.subscribe(() => {
      this.user = this.authService.getUser()
      this.userChannels = this.user.videoChannels

      const channelFilters = this.userChannels.map(c => {
        return {
          value: 'channel:' + c.name,
          label: c.name
        }
      })

      this.inputFilters = [
        {
          title: $localize`Advanced filters`,
          children: [
            {
              value: 'isLive:true',
              label: $localize`Only live videos`
            }
          ]
        },

        {
          title: $localize`Channel filters`,
          children: channelFilters
        }
      ]
    })
  }

  onSearch (search: string) {
    this.search = search
    this.reloadData()
  }

  reloadData () {
    this.videosSelection.reloadVideos()
  }

  onChangeSortColumn () {
    this.videosSelection.reloadVideos()
  }

  disableForReuse () {
    this.disabled = true
  }

  enabledForReuse () {
    this.disabled = false
  }

  getVideosObservable (page: number) {
    const newPagination = immutableAssign(this.pagination, { currentPage: page })

    return this.videoService.getMyVideos({
      videoPagination: newPagination,
      sort: this.sort,
      userChannels: this.userChannels,
      search: this.search
    }).pipe(
      tap(res => this.pagination.totalItems = res.total),
      tap(({ data }) => this.fetchVideosContainedInPlaylists(data))
    )
  }

  private fetchVideosContainedInPlaylists (videos: Video[]) {
    this.playlistService.doVideosExistInPlaylist(videos.map(v => v.id))
      .subscribe(result => {
        this.videosContainedInPlaylists = Object.keys(result).reduce((acc, videoId) => ({
          ...acc,
          [videoId]: uniqBy(result[videoId], (p: VideoExistInPlaylist) => p.playlistId)
        }), this.videosContainedInPlaylists)
      })
  }

  async deleteSelectedVideos () {
    const toDeleteVideosIds = Object.keys(this.selection)
                                    .filter(k => this.selection[k] === true)
                                    .map(k => parseInt(k, 10))

    const res = await this.confirmService.confirm(
      prepareIcu($localize`Do you really want to delete {length, plural, =1 {this video} other {{length} videos}}?`)(
        { length: toDeleteVideosIds.length },
        $localize`Do you really want to delete ${toDeleteVideosIds.length} videos?`
      ),
      $localize`Delete`
    )
    if (res === false) return

    const observables: Observable<any>[] = []
    for (const videoId of toDeleteVideosIds) {
      const o = this.videoService.removeVideo(videoId)
                    .pipe(tap(() => this.removeVideoFromArray(videoId)))

      observables.push(o)
    }

    concat(...observables)
      .pipe(toArray())
      .subscribe({
        next: () => {
          this.notifier.success(
            prepareIcu($localize`{length, plural, =1 {Video has been deleted} other {{length} videos have been deleted}}`)(
              { length: toDeleteVideosIds.length },
              $localize`${toDeleteVideosIds.length} have been deleted.`
            )
          )

          this.selection = {}
        },

        error: err => this.notifier.error(err.message)
      })
  }

  onVideoRemoved (video: Video) {
    this.removeVideoFromArray(video.id)
  }

  changeOwnership (video: Video) {
    this.videoChangeOwnershipModal.show(video)
  }

  private removeVideoFromArray (id: number) {
    this.videos = this.videos.filter(v => v.id !== id)
  }

  private buildActions () {
    this.moreVideoActions = [
      [
        {
          label: $localize`Change ownership`,
          handler: ({ video }) => this.changeOwnership(video),
          iconName: 'ownership-change'
        }
      ]
    ]
  }
}
