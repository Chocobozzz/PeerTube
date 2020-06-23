import { Observable } from 'rxjs'
import {
  AfterContentInit,
  Component,
  ContentChildren,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  QueryList,
  TemplateRef
} from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { AuthService, ComponentPagination, LocalStorageService, Notifier, ScreenService, ServerService, UserService } from '@app/core'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { ResultList, VideoSortField } from '@shared/models'
import { PeerTubeTemplateDirective, Video } from '../shared-main'
import { AbstractVideoList } from './abstract-video-list'
import { MiniatureDisplayOptions, OwnerDisplayType } from './video-miniature.component'

export type SelectionType = { [ id: number ]: boolean }

@Component({
  selector: 'my-videos-selection',
  templateUrl: './videos-selection.component.html',
  styleUrls: [ './videos-selection.component.scss' ]
})
export class VideosSelectionComponent extends AbstractVideoList implements OnInit, OnDestroy, AfterContentInit {
  @Input() pagination: ComponentPagination
  @Input() titlePage: string
  @Input() miniatureDisplayOptions: MiniatureDisplayOptions
  @Input() ownerDisplayType: OwnerDisplayType

  @Input() getVideosObservableFunction: (page: number, sort?: VideoSortField) => Observable<ResultList<Video>>

  @ContentChildren(PeerTubeTemplateDirective) templates: QueryList<PeerTubeTemplateDirective<'rowButtons' | 'globalButtons'>>

  @Output() selectionChange = new EventEmitter<SelectionType>()
  @Output() videosModelChange = new EventEmitter<Video[]>()

  _selection: SelectionType = {}

  rowButtonsTemplate: TemplateRef<any>
  globalButtonsTemplate: TemplateRef<any>

  constructor (
    protected i18n: I18n,
    protected router: Router,
    protected route: ActivatedRoute,
    protected notifier: Notifier,
    protected authService: AuthService,
    protected userService: UserService,
    protected screenService: ScreenService,
    protected storageService: LocalStorageService,
    protected serverService: ServerService
  ) {
    super()
  }

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

  ngOnInit () {
    super.ngOnInit()
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
  }

  ngOnDestroy () {
    super.ngOnDestroy()
  }

  getVideosObservable (page: number) {
    return this.getVideosObservableFunction(page, this.sort)
  }

  abortSelectionMode () {
    this._selection = {}
  }

  isInSelectionMode () {
    return Object.keys(this._selection).some(k => this._selection[ k ] === true)
  }

  generateSyndicationList () {
    throw new Error('Method not implemented.')
  }

  protected onMoreVideos () {
    this.videosModel = this.videos
  }
}
