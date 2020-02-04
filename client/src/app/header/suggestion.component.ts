import { Input, Component, Output, EventEmitter, OnInit, ChangeDetectionStrategy } from '@angular/core'
import { RouterLink } from '@angular/router'
import { ListKeyManagerOption } from '@angular/cdk/a11y'

export type Result = {
  text: string
  type: 'channel' | 'suggestion' | 'search-channel' | 'search-instance' | 'search-global' | 'search-any'
  routerLink?: RouterLink,
  default?: boolean
}

@Component({
  selector: 'my-suggestion',
  templateUrl: './suggestion.component.html',
  styleUrls: [ './suggestion.component.scss' ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SuggestionComponent implements OnInit, ListKeyManagerOption {
  @Input() result: Result
  @Input() highlight: string
  @Output() selected = new EventEmitter()

  disabled = false
  active = false

  getLabel () {
    return this.result.text
  }

  ngOnInit () {
    if (this.result.default) this.active = true
  }

  selectItem () {
    this.selected.emit(this.result)
  }
}
