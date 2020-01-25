import {
  Component,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnInit,
  OnDestroy,
  QueryList
} from '@angular/core'
import { Router, NavigationEnd } from '@angular/router'
import { AuthService } from '@app/core'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { filter } from 'rxjs/operators'
import { ListKeyManager } from '@angular/cdk/a11y'
import { UP_ARROW, DOWN_ARROW, ENTER, TAB } from '@angular/cdk/keycodes'
import { SuggestionComponent } from './suggestion.component'

@Component({
  selector: 'my-search-typeahead',
  templateUrl: './search-typeahead.component.html',
  styleUrls: [ './search-typeahead.component.scss' ]
})
export class SearchTypeaheadComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('contentWrapper', { static: true }) contentWrapper: ElementRef

  hasChannel = false
  inChannel = false
  newSearch = true

  searchInput: HTMLInputElement
  URIPolicy: 'only-followed' | 'any' = 'any'

  URIPolicyText: string
  inAllText: string
  inThisChannelText: string
  globalSearchIndex = 'https://index.joinpeertube.org'

  keyboardEventsManager: ListKeyManager<SuggestionComponent>
  results: any[] = []

  constructor (
    private authService: AuthService,
    private router: Router,
    private i18n: I18n
  ) {
    this.URIPolicyText = this.i18n('Determines whether you can resolve any distant content, or if your instance only allows doing so for instances it follows.')
    this.inAllText = this.i18n('In all PeerTube')
    this.inThisChannelText = this.i18n('In this channel')
  }

  ngOnInit () {
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.hasChannel = event.url.startsWith('/videos/watch')
        this.inChannel = event.url.startsWith('/video-channels')
        this.computeResults()
      })
  }

  ngOnDestroy () {
    if (this.keyboardEventsManager) this.keyboardEventsManager.change.unsubscribe()
  }

  ngAfterViewInit () {
    this.searchInput = this.contentWrapper.nativeElement.childNodes[0]
    this.searchInput.addEventListener('input', this.computeResults.bind(this))
    this.searchInput.addEventListener('keyup', this.handleKeyUp.bind(this))
  }

  get hasSearch () {
    return !!this.searchInput && !!this.searchInput.value
  }

  get activeResult () {
    return this.keyboardEventsManager && this.keyboardEventsManager.activeItem && this.keyboardEventsManager.activeItem.result
  }

  get showHelp () {
    return this.hasSearch && this.newSearch && this.activeResult && this.activeResult.type === 'search-global' || false
  }

  computeResults () {
    this.newSearch = true
    let results = [
      {
        text: 'Maître poney',
        type: 'channel'
      }
    ]

    if (this.hasSearch) {
      results = [
        {
          text: this.searchInput.value,
          type: 'search-channel'
        },
        {
          text: this.searchInput.value,
          type: 'search-instance'
        },
        {
          text: this.searchInput.value,
          type: 'search-global'
        },
        ...results
      ]
    }

    this.results = results.filter(
      result => {
        // if we're not in a channel or one of its videos/playlits, show all channel-related results
        if (!(this.hasChannel || this.inChannel)) return !result.type.includes('channel')
        // if we're in a channel, show all channel-related results except for the channel redirection itself
        if (this.inChannel) return !(result.type === 'channel')
        return true
      }
    )
  }

  initKeyboardEventsManager (event: { items: QueryList<SuggestionComponent>, index?: number }) {
    if (this.keyboardEventsManager) this.keyboardEventsManager.change.unsubscribe()
    this.keyboardEventsManager = new ListKeyManager(event.items)
    if (event.index !== undefined) {
      this.keyboardEventsManager.setActiveItem(event.index)
      event.items.forEach(e => e.active = false)
      this.keyboardEventsManager.activeItem.active = true
    }
    this.keyboardEventsManager.change.subscribe(
      val => {
        event.items.forEach(e => e.active = false)
        this.keyboardEventsManager.activeItem.active = true
      }
    )
  }

  isUserLoggedIn () {
    return this.authService.isLoggedIn()
  }

  handleKeyUp (event: KeyboardEvent, indexSelected?: number) {
    event.stopImmediatePropagation()
    if (this.keyboardEventsManager) {
      if (event.keyCode === TAB) {
        this.keyboardEventsManager.setNextItemActive()
        return false
      } else if (event.keyCode === DOWN_ARROW || event.keyCode === UP_ARROW) {
        this.keyboardEventsManager.onKeydown(event)
        return false
      } else if (event.keyCode === ENTER) {
        this.newSearch = false
        // this.router.navigate(this.keyboardEventsManager.activeItem.result)
        return false
      }
    }
  }
}
