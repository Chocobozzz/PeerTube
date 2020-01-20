import { Component, ViewChild, ElementRef, AfterViewInit, OnInit } from '@angular/core'
import { Router, NavigationEnd } from '@angular/router'
import { AuthService } from '@app/core'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { filter } from 'rxjs/operators'
import { ListKeyManager, ListKeyManagerOption } from '@angular/cdk/a11y'
import { UP_ARROW, DOWN_ARROW, ENTER } from '@angular/cdk/keycodes'

@Component({
  selector: 'my-search-typeahead',
  templateUrl: './search-typeahead.component.html',
  styleUrls: [ './search-typeahead.component.scss' ]
})
export class SearchTypeaheadComponent implements OnInit, AfterViewInit {
  @ViewChild('contentWrapper', { static: true }) contentWrapper: ElementRef
  @ViewChild('optionsList', { static: true }) optionsList: ElementRef

  hasChannel = false
  inChannel = false
  keyboardEventsManager: ListKeyManager<ListKeyManagerOption>

  searchInput: HTMLInputElement
  URIPolicy: 'only-followed' | 'any' = 'any'

  URIPolicyText: string
  inAllText: string
  inThisChannelText: string

  results: any[] = []

  constructor (
    private authService: AuthService,
    private router: Router,
    private i18n: I18n
  ) {
    this.URIPolicyText = this.i18n('Determines whether you can resolve any distant content from its URL, or if your instance only allows doing so for instances it follows.')
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

  ngAfterViewInit () {
    this.searchInput = this.contentWrapper.nativeElement.childNodes[0]
    this.searchInput.addEventListener('input', this.computeResults.bind(this))
  }

  get hasSearch () {
    return !!this.searchInput && !!this.searchInput.value
  }

  computeResults () {
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

  isUserLoggedIn () {
    return this.authService.isLoggedIn()
  }

  handleKeyUp (event: KeyboardEvent) {
    event.stopImmediatePropagation()
    if (this.keyboardEventsManager) {
      if (event.keyCode === DOWN_ARROW || event.keyCode === UP_ARROW) {
        // passing the event to key manager so we get a change fired
        this.keyboardEventsManager.onKeydown(event)
        return false
      } else if (event.keyCode === ENTER) {
        // when we hit enter, the keyboardManager should call the selectItem method of the `ListItemComponent`
        // this.keyboardEventsManager.activeItem
        return false
      }
    }
  }
}
