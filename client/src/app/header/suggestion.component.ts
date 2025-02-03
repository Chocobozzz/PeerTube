import { ListKeyManagerOption } from '@angular/cdk/a11y'
import { NgIf } from '@angular/common'
import { Component, Input, OnInit } from '@angular/core'
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
  imports: [ GlobalIconComponent, NgIf ]
})
export class SuggestionComponent implements OnInit, ListKeyManagerOption {
  @Input() result: SuggestionPayload
  @Input() highlight: string
  @Input() describedby: string

  disabled = false
  active = false

  getTitle () {
    if (this.result.type === 'search-instance') return $localize`Search "${this.result.text}" in this instance's network`
    if (this.result.type === 'search-index') return $localize`Search "${this.result.text}" in the vidiverse`

    return undefined
  }

  ngOnInit () {
    if (this.result.default) this.active = true
  }
}
