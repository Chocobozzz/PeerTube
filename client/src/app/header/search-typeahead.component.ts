import {
  Component,
  AfterViewInit,
  OnInit,
  OnDestroy,
  QueryList,
  ViewChild,
  ElementRef
} from '@angular/core'
import { Router, Params, ActivatedRoute } from '@angular/router'
import { AuthService, ServerService } from '@app/core'
import { first, tap } from 'rxjs/operators'
import { ListKeyManager } from '@angular/cdk/a11y'
import { UP_ARROW, DOWN_ARROW, ENTER } from '@angular/cdk/keycodes'
import { SuggestionComponent, Result } from './suggestion.component'
import { of } from 'rxjs'
import { getParameterByName } from '@app/shared/misc/utils'
import { ServerConfig } from '@shared/models'

@Component({
  selector: 'my-search-typeahead',
  templateUrl: './search-typeahead.component.html',
  styleUrls: [ './search-typeahead.component.scss' ]
})
export class SearchTypeaheadComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('searchVideo', { static: true }) searchInput: ElementRef<HTMLInputElement>

  hasChannel = false
  inChannel = false
  newSearch = true

  search = ''
  serverConfig: ServerConfig

  inThisChannelText: string

  keyboardEventsManager: ListKeyManager<SuggestionComponent>
  results: any[] = []

  constructor (
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private serverService: ServerService
  ) {}

  ngOnInit () {
    this.serverService.getConfig()
      .subscribe(config => this.serverConfig = config)
  }

  ngOnDestroy () {
    if (this.keyboardEventsManager) this.keyboardEventsManager.change.unsubscribe()
  }

  ngAfterViewInit () {
    this.search = getParameterByName('search', window.location.href) || ''
  }

  get activeResult () {
    return this.keyboardEventsManager && this.keyboardEventsManager.activeItem && this.keyboardEventsManager.activeItem.result
  }

  get showInstructions () {
    return !this.search
  }

  get showHelp () {
    return this.search && this.newSearch && this.activeResult && this.activeResult.type === 'search-global' || false
  }

  get anyURI () {
    if (!this.serverConfig) return false
    return this.authService.isLoggedIn()
      ? this.serverConfig.search.remoteUri.users
      : this.serverConfig.search.remoteUri.anonymous
  }

  onSearchChange () {
    this.computeResults()
  }

  computeResults () {
    this.newSearch = true
    let results: Result[] = []

    if (this.search) {
      results = [
        /* Channel search is still unimplemented. Uncomment when it is.
        {
          text: this.search,
          type: 'search-channel'
        },
        */
        {
          text: this.search,
          type: 'search-instance',
          default: true
        },
        /* Global search is still unimplemented. Uncomment when it is.
        {
          text: this.search,
          type: 'search-global'
        },
        */
        ...results
      ]
    }

    this.results = results.filter(
      (result: Result) => {
        // if we're not in a channel or one of its videos/playlits, show all channel-related results
        if (!(this.hasChannel || this.inChannel)) return !result.type.includes('channel')
        // if we're in a channel, show all channel-related results except for the channel redirection itself
        if (this.inChannel) return result.type !== 'channel'
        // all other result types are kept
        return true
      }
    )
  }

  setEventItems (event: { items: QueryList<SuggestionComponent>, index?: number }) {
    event.items.forEach(e => {
      if (this.keyboardEventsManager.activeItem && this.keyboardEventsManager.activeItem === e) {
        this.keyboardEventsManager.activeItem.active = true
      } else {
        e.active = false
      }
    })
  }

  initKeyboardEventsManager (event: { items: QueryList<SuggestionComponent>, index?: number }) {
    if (this.keyboardEventsManager) this.keyboardEventsManager.change.unsubscribe()
    this.keyboardEventsManager = new ListKeyManager(event.items)
    if (event.index !== undefined) {
      this.keyboardEventsManager.setActiveItem(event.index)
    } else {
      this.keyboardEventsManager.setFirstItemActive()
    }
    this.keyboardEventsManager.change.subscribe(
      _ => this.setEventItems(event)
    )
  }

  handleKeyUp (event: KeyboardEvent, indexSelected?: number) {
    event.stopImmediatePropagation()
    if (this.keyboardEventsManager) {
      if (event.keyCode === DOWN_ARROW || event.keyCode === UP_ARROW) {
        this.keyboardEventsManager.onKeydown(event)
        return false
      } else if (event.keyCode === ENTER) {
        this.newSearch = false
        this.doSearch()
        return false
      }
    }
  }

  doSearch () {
    const queryParams: Params = {}

    if (window.location.pathname === '/search' && this.route.snapshot.queryParams) {
      Object.assign(queryParams, this.route.snapshot.queryParams)
    }

    Object.assign(queryParams, { search: this.search })

    const o = this.authService.isLoggedIn()
      ? this.loadUserLanguagesIfNeeded(queryParams)
      : of(true)

    o.subscribe(() => this.router.navigate([ '/search' ], { queryParams }))
  }

  private loadUserLanguagesIfNeeded (queryParams: any) {
    if (queryParams && queryParams.languageOneOf) return of(queryParams)

    return this.authService.userInformationLoaded
               .pipe(
                 first(),
                 tap(() => Object.assign(queryParams, { languageOneOf: this.authService.getUser().videoLanguages }))
               )
  }
}
