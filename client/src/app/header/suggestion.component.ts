import { Input, Component, Output, EventEmitter, OnInit } from '@angular/core'
import { RouterLink } from '@angular/router'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { ListKeyManagerOption } from '@angular/cdk/a11y'

type Result = {
  text: string
  type: 'channel' | 'suggestion' | 'search-channel' | 'search-instance' | 'search-global' | 'search-any'
  routerLink?: RouterLink
}

@Component({
  selector: 'my-suggestion',
  templateUrl: './suggestion.component.html',
  styleUrls: [ './suggestion.component.scss' ]
})
export class SuggestionComponent implements OnInit, ListKeyManagerOption {
  @Input() result: Result
  @Input() highlight: string
  @Output() selected = new EventEmitter()

  inAllText: string
  inThisChannelText: string
  inThisInstanceText: string

  disabled = false
  active = false

  constructor (
    private i18n: I18n
  ) {
    this.inAllText = this.i18n('In the vidiverse')
    this.inThisChannelText = this.i18n('In this channel')
    this.inThisInstanceText = this.i18n('In this instance')
  }

  getLabel () {
    return this.result.text
  }

  ngOnInit () {
    this.active = false
  }

  selectItem () {
    this.selected.emit(this.result)
  }
}
