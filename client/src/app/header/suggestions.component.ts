import { Input, QueryList, Component, Output, AfterViewInit, EventEmitter, ViewChildren, ChangeDetectionStrategy } from '@angular/core'
import { SuggestionComponent } from './suggestion.component'

@Component({
  selector: 'my-suggestions',
  templateUrl: './suggestions.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SuggestionsComponent implements AfterViewInit {
  @Input() results: any[]
  @Input() highlight: string
  @ViewChildren(SuggestionComponent) listItems: QueryList<SuggestionComponent>
  @Output() init = new EventEmitter()

  ngAfterViewInit () {
    this.listItems.changes.subscribe(
      _ => this.init.emit({ items: this.listItems })
    )
  }

  hoverItem (index: number) {
    this.init.emit({ items: this.listItems, index: index })
  }
}
