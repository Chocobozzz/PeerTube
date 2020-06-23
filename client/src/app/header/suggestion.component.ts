import { ListKeyManagerOption } from '@angular/cdk/a11y'
import { Component, Input, OnInit } from '@angular/core'
import { RouterLink } from '@angular/router'

export type SuggestionPayload = {
  text: string
  type: SuggestionPayloadType
  routerLink?: RouterLink
  default: boolean
}

export type SuggestionPayloadType = 'search-instance' | 'search-index'

@Component({
  selector: 'my-suggestion',
  templateUrl: './suggestion.component.html',
  styleUrls: [ './suggestion.component.scss' ]
})
export class SuggestionComponent implements OnInit, ListKeyManagerOption {
  @Input() result: SuggestionPayload
  @Input() highlight: string

  disabled = false
  active = false

  getLabel () {
    return this.result.text
  }

  ngOnInit () {
    if (this.result.default) this.active = true
  }
}
