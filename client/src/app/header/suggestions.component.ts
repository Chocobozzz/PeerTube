import { Input, QueryList, Component, Output, AfterViewInit, EventEmitter, ViewChildren } from '@angular/core'
import { SuggestionComponent } from './suggestion.component'

@Component({
  selector: 'my-suggestions',
  template: `
    <ul role="listbox" class="p-0 m-0">
      <li *ngFor="let result of results; let i = index" class="d-flex flex-justify-start flex-items-center p-0 f5"
          role="option" aria-selected="true" (mouseenter)="hoverItem(i)">
        <my-suggestion [result]="result" [highlight]="highlight"></my-suggestion>
      </li>
    </ul>
  `
})
export class SuggestionsComponent implements AfterViewInit {
  @Input() results: any[]
  @Input() highlight: string
  @ViewChildren(SuggestionComponent) listItems: QueryList<SuggestionComponent>
  @Output() init = new EventEmitter()

  ngAfterViewInit () {
    this.listItems.changes.subscribe(
      val => this.init.emit({ items: this.listItems })
    )
  }

  hoverItem (index: number) {
    this.init.emit({ items: this.listItems, index: index })
  }
}
