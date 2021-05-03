import { Component, EventEmitter, Input, Output } from '@angular/core'
import { Params } from '@angular/router'

export type AdvancedInputFilter = {
  label: string
  queryParams: Params
}

@Component({
  selector: 'my-advanced-input-filter',
  templateUrl: './advanced-input-filter.component.html',
  styleUrls: [ './advanced-input-filter.component.scss' ]
})
export class AdvancedInputFilterComponent {
  @Input() filters: AdvancedInputFilter[] = []

  @Output() resetTableFilter = new EventEmitter<void>()
  @Output() search = new EventEmitter<Event>()

  onSearch (event: Event) {
    this.search.emit(event)
  }

  onResetTableFilter () {
    this.resetTableFilter.emit()
  }
}
