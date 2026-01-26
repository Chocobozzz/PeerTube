import { ListKeyManagerOption } from '@angular/cdk/a11y'
import { Component, OnInit, input } from '@angular/core'
import { RouterLink } from '@angular/router'
import { GlobalIconComponent } from '../shared/shared-icons/global-icon.component'

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
  styleUrls: [ './suggestion.component.scss' ],
  imports: [ GlobalIconComponent ]
})
export class SuggestionComponent implements OnInit, ListKeyManagerOption {
  readonly result = input<SuggestionPayload>(undefined)
  readonly highlight = input<string>(undefined)
  readonly describedby = input<string>(undefined)

  disabled = false
  active = false

  getTitle () {
    const result = this.result()
    if (result.type === 'search-instance') return $localize`Search "${result.text}" in this instance's network`
    if (result.type === 'search-index') return $localize`Search "${result.text}" in the vidiverse`

    return undefined
  }

  ngOnInit () {
    if (this.result().default) this.active = true
  }
}
