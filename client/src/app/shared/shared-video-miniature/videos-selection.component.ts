import { Observable, Subject } from 'rxjs'
import { AfterContentInit, Component, ContentChildren, EventEmitter, Input, Output, QueryList, TemplateRef } from '@angular/core'
import { ComponentPagination, Notifier, User } from '@app/core'
import { logger } from '@root-helpers/logger'
import { objectKeysTyped } from '@peertube/peertube-core-utils'
import { ResultList, VideosExistInPlaylists, VideoSortField } from '@peertube/peertube-models'
import { PeerTubeTemplateDirective, Video } from '../shared-main'
import { MiniatureDisplayOptions } from './video-miniature.component'

export type SelectionType = { [ id: number ]: boolean }

@Component({
  selector: 'my-videos-selection',
  templateUrl: './videos-selection.component.html',
  styleUrls: [ './videos-selection.component.scss' ]
})
export class VideosSelectionComponent implements AfterContentInit {
  @Input() videosContainedInPlaylists: VideosExistInPlaylists
  @Input() user: User
  @Input() pagination: ComponentPagination

  @Input() titlePage: string

  @Input() miniatureDisplayOptions: MiniatureDisplayOptions

  @Input() noResultMessage = $localize`No results.`
  @Input() enableSelection = true

  @Input() disabled = false

  @Input() getVideosObservableFunction: (page: number, sort?: VideoSortField) => Observable<ResultList<Video>>

  @ContentChildren(PeerTubeTemplateDirective) templates: QueryList<PeerTubeTemplateDirective<'rowButtons' | 'globalButtons'>>

  @Output() selectionChange = new EventEmitter<SelectionType>()
  @Output() videosModelChange = new EventEmitter<Video[]>()

  _selection: SelectionType = {}

  rowButtonsTemplate: TemplateRef<any>
  globalButtonsTemplate: TemplateRef<any>

  videos: Video[] = []
  sort: VideoSortField = '-publishedAt'

  onDataSubject = new Subject<any[]>()

  hasDoneFirstQuery = false

  private lastQueryLength: number

  constructor (
    private notifier: Notifier
  ) { }

  @Input() get selection () {
    return this._selection
  }

  set selection (selection: SelectionType) {
    this._selection = selection
    this.selectionChange.emit(this._selection)
  }

  @Input() get videosModel () {
    return this.videos
  }

  set videosModel (videos: Video[]) {
    this.videos = videos
    this.videosModelChange.emit(this.videos)
  }

  ngAfterContentInit () {
    {
      const t = this.templates.find(t => t.name === 'rowButtons')
      if (t) this.rowButtonsTemplate = t.template
    }

    {
      const t = this.templates.find(t => t.name === 'globalButtons')
      if (t) this.globalButtonsTemplate = t.template
    }

    this.loadMoreVideos()
  }

  getVideosObservable (page: number) {
    return this.getVideosObservableFunction(page, this.sort)
  }

  abortSelectionMode () {
    this._selection = {}
  }

  isInSelectionMode () {
    return objectKeysTyped(this._selection).some(k => this._selection[k] === true)
  }

  videoById (index: number, video: Video) {
    return video.id
  }

  onNearOfBottom () {
    if (this.disabled) return

    // No more results
    if (this.lastQueryLength !== undefined && this.lastQueryLength < this.pagination.itemsPerPage) return

    this.pagination.currentPage += 1

    this.loadMoreVideos()
  }

  loadMoreVideos (reset = false) {
    if (reset) this.hasDoneFirstQuery = false

    this.getVideosObservable(this.pagination.currentPage)
      .subscribe({
        next: ({ data }) => {
          this.hasDoneFirstQuery = true
          this.lastQueryLength = data.length

          if (reset) this.videos = []
          this.videos = this.videos.concat(data)
          this.videosModel = this.videos

          this.onDataSubject.next(data)
        },

        error: err => {
          const message = $localize`Cannot load more videos. Try again later.`

          logger.error(message, err)
          this.notifier.error(message)
        }
      })
  }

  reloadVideos () {
    this.pagination.currentPage = 1
    this.loadMoreVideos(true)
  }

  removeVideoFromArray (video: Video) {
    this.videos = this.videos.filter(v => v.id !== video.id)
  }
}
