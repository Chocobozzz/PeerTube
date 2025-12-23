import { NgTemplateOutlet } from '@angular/common'
import { AfterContentInit, Component, contentChildren, inject, input, model, TemplateRef } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { ComponentPagination, Notifier, resetCurrentPage, User } from '@app/core'
import { objectKeysTyped } from '@peertube/peertube-core-utils'
import { ResultList, VideoSortField } from '@peertube/peertube-models'
import { logger } from '@root-helpers/logger'
import { Observable, Subject } from 'rxjs'
import { PeertubeCheckboxComponent } from '../shared-forms/peertube-checkbox.component'
import { InfiniteScrollerDirective } from '../shared-main/common/infinite-scroller.directive'
import { PeerTubeTemplateDirective } from '../shared-main/common/peertube-template.directive'
import { Video } from '../shared-main/video/video.model'
import { MiniatureDisplayOptions, VideoMiniatureComponent } from './video-miniature.component'

export type SelectionType = { [id: number]: boolean }

@Component({
  selector: 'my-videos-selection',
  templateUrl: './videos-selection.component.html',
  styleUrls: [ './videos-selection.component.scss' ],
  imports: [ InfiniteScrollerDirective, PeertubeCheckboxComponent, FormsModule, VideoMiniatureComponent, NgTemplateOutlet ]
})
export class VideosSelectionComponent implements AfterContentInit {
  private notifier = inject(Notifier)

  readonly user = input<User>(undefined)
  readonly pagination = input<ComponentPagination>(undefined)

  readonly titlePage = input<string>(undefined)

  readonly miniatureDisplayOptions = input<MiniatureDisplayOptions>(undefined)

  readonly noResultMessage = input($localize`No results.`)
  readonly enableSelection = input(true)

  readonly disabled = input(false)

  readonly getVideosObservableFunction = input<(page: number, sort?: VideoSortField) => Observable<ResultList<Video>>>(undefined)

  readonly templates = contentChildren(PeerTubeTemplateDirective)

  readonly selection = model<SelectionType>({})
  readonly videos = model<Video[]>([])

  rowButtonsTemplate: TemplateRef<any>
  globalButtonsTemplate: TemplateRef<any>

  sort: VideoSortField = '-publishedAt'

  onDataSubject = new Subject<any[]>()

  hasDoneFirstQuery = false

  private lastQueryLength: number

  ngAfterContentInit () {
    {
      const t = this.templates().find(t => t.name() === 'rowButtons')
      if (t) this.rowButtonsTemplate = t.template
    }

    {
      const t = this.templates().find(t => t.name() === 'globalButtons')
      if (t) this.globalButtonsTemplate = t.template
    }
  }

  getVideosObservable (page: number) {
    return this.getVideosObservableFunction()(page, this.sort)
  }

  abortSelectionMode () {
    this.selection.update(() => ({}))
  }

  isInSelectionMode () {
    return objectKeysTyped(this.selection())
      .some(k => this.selection()[k] === true)
  }

  videoById (_index: number, video: Video) {
    return video.id
  }

  onNearOfBottom () {
    if (this.disabled()) return

    // No more results
    if (this.lastQueryLength !== undefined && this.lastQueryLength < this.pagination().itemsPerPage) return

    this.pagination().currentPage += 1

    this.loadMoreVideos()
  }

  loadMoreVideos (reset = false) {
    if (reset) this.hasDoneFirstQuery = false

    this.getVideosObservable(this.pagination().currentPage)
      .subscribe({
        next: ({ data }) => {
          this.hasDoneFirstQuery = true
          this.lastQueryLength = data.length

          if (reset) this.videos.set([])
          this.videos.update(videos => videos.concat(data))

          this.onDataSubject.next(data)
        },

        error: err => {
          const message = $localize`Cannot load more videos. Please try again later.`

          logger.error(message, err)
          this.notifier.error(message)
        }
      })
  }

  reloadVideos () {
    resetCurrentPage(this.pagination())
    this.loadMoreVideos(true)
  }
}
