import { Input, Component, Output, EventEmitter, OnInit, ChangeDetectionStrategy, OnChanges } from '@angular/core'
import { RouterLink } from '@angular/router'
import { ListKeyManagerOption } from '@angular/cdk/a11y'

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
