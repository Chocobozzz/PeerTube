import { NgIf } from '@angular/common'
import { Component, OnInit, ViewChild } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { ActivatedRoute, Router, RouterLink } from '@angular/router'
import { AuthService, ComponentPagination, ConfirmService, Notifier, ScreenService, ServerService, User } from '@app/core'
import { DisableForReuseHook } from '@app/core/routing/disable-for-reuse-hook'
import { formatICU, immutableAssign } from '@app/helpers'
import { DropdownAction } from '@app/shared/shared-main/buttons/action-dropdown.component'
import { Video } from '@app/shared/shared-main/video/video.model'
import { VideoService } from '@app/shared/shared-main/video/video.service'
import { LiveStreamInformationComponent } from '@app/shared/shared-video-live/live-stream-information.component'
import { MiniatureDisplayOptions } from '@app/shared/shared-video-miniature/video-miniature.component'
import { SelectionType, VideosSelectionComponent } from '@app/shared/shared-video-miniature/videos-selection.component'
import { VideoPlaylistService } from '@app/shared/shared-video-playlist/video-playlist.service'
import { VideoChannel, VideoExistInPlaylist, VideosExistInPlaylists, VideoSortField } from '@peertube/peertube-models'
import { uniqBy } from 'lodash-es'
import { concat, Observable } from 'rxjs'
import { tap, toArray } from 'rxjs/operators'
import { AdvancedInputFilter, AdvancedInputFilterComponent } from '../../shared/shared-forms/advanced-input-filter.component'
import { GlobalIconComponent } from '../../shared/shared-icons/global-icon.component'
import { PeerTubeTemplateDirective } from '../../shared/shared-main/angular/peertube-template.directive'
import { EditButtonComponent } from '../../shared/shared-main/buttons/edit-button.component'
import {
  VideoActionsDisplayType,
  VideoActionsDropdownComponent
} from '../../shared/shared-video-miniature/video-actions-dropdown.component'
import { VideoChangeOwnershipComponent } from './modals/video-change-ownership.component'

@Component({
  templateUrl: './my-videos.component.html',
  styleUrls: [ './my-videos.component.scss' ],
  standalone: true,
  imports: [
    GlobalIconComponent,
    NgIf,
    RouterLink,
    AdvancedInputFilterComponent,
    FormsModule,
    VideosSelectionComponent,
    PeerTubeTemplateDirective,
    EditButtonComponent,
    VideoActionsDropdownComponent,
    VideoChangeOwnershipComponent
  ]
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
    playlist: true,
    download: true,
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

    this.user = this.authService.getUser()
    this.userChannels = this.user.videoChannels

    const channelFilters = [ ...this.userChannels ]
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
      .map(c => {
        return {
          value: 'channel:' + c.name,
          label: c.displayName
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
          [videoId]: uniqBy(result[+videoId], (p: VideoExistInPlaylist) => p.playlistId)
        }), this.videosContainedInPlaylists)
      })
  }

  async deleteSelectedVideos () {
    const toDeleteVideosIds = Object.entries(this.selection)
                                    .filter(([ _k, v ]) => v === true)
                                    .map(([ k, _v ]) => parseInt(k, 10))

    const res = await this.confirmService.confirm(
      formatICU(
        $localize`Do you really want to delete {length, plural, =1 {this video} other {{length} videos}}?`,
        { length: toDeleteVideosIds.length }
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
            formatICU(
              $localize`{length, plural, =1 {Video has been deleted} other {{length} videos have been deleted}}`,
              { length: toDeleteVideosIds.length }
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
