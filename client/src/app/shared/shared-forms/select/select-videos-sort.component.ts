import { Component, forwardRef, OnInit, inject, input } from '@angular/core'
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms'
import { ServerService } from '@app/core'
import { SelectOptionsItem } from '../../../../types/select-options-item.model'
import { SelectOptionsComponent } from './select-options.component'
import { HTMLServerConfig } from '@peertube/peertube-models'

@Component({
  selector: 'my-select-videos-sort',
  template: `
  <my-select-options
    [inputId]="inputId()"

    [items]="sortItems"

    [(ngModel)]="selectedId"
    (ngModelChange)="onModelChange()"
  ></my-select-options>
  `,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectVideosSortComponent),
      multi: true
    }
  ],
  imports: [ FormsModule, SelectOptionsComponent ]
})
export class SelectVideosSortComponent implements ControlValueAccessor, OnInit {
  private server = inject(ServerService)

  readonly inputId = input.required<string>()

  sortItems: SelectOptionsItem[]
  selectedId: string

  private serverConfig: HTMLServerConfig

  ngOnInit () {
    this.serverConfig = this.server.getHTMLConfig()

    this.buildSortItems()
  }

  private buildSortItems () {
    this.sortItems = [
      { id: '-publishedAt', label: $localize`Recently Added` },
      { id: '-originallyPublishedAt', label: $localize`Original Publication Date` },
      { id: 'name', label: $localize`Name` }
    ]

    if (this.isTrendingSortEnabled('most-viewed')) {
      this.sortItems.push({ id: '-trending', label: $localize`Recent Views` })
    }

    if (this.isTrendingSortEnabled('hot')) {
      this.sortItems.push({ id: '-hot', label: $localize`Hot` })
    }

    if (this.isTrendingSortEnabled('most-liked')) {
      this.sortItems.push({ id: '-likes', label: $localize`Likes` })
    }

    this.sortItems.push({ id: '-views', label: $localize`Global Views` })
  }

  private isTrendingSortEnabled (sort: 'most-viewed' | 'hot' | 'most-liked') {
    return this.serverConfig.trending.videos.algorithms.enabled.includes(sort)
  }

  propagateChange = (_: any) => {
    // empty
  }

  writeValue (id: string) {
    this.selectedId = id
  }

  registerOnChange (fn: (_: any) => void) {
    this.propagateChange = fn
  }

  registerOnTouched () {
    // Unused
  }

  onModelChange () {
    this.propagateChange(this.selectedId)
  }
}
