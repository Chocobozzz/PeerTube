import { Component, forwardRef, OnInit, input } from '@angular/core'
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms'
import { SelectOptionsItem } from '../../../../types/select-options-item.model'
import { SelectOptionsComponent } from './select-options.component'

@Component({
  selector: 'my-select-videos-scope',
  template: `
  <my-select-options
    [inputId]="inputId()"

    [items]="scopeItems"

    [(ngModel)]="selectedId"
    (ngModelChange)="onModelChange()"
  ></my-select-options>
  `,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectVideosScopeComponent),
      multi: true
    }
  ],
  imports: [ FormsModule, SelectOptionsComponent ]
})
export class SelectVideosScopeComponent implements ControlValueAccessor, OnInit {
  readonly inputId = input.required<string>()

  scopeItems: SelectOptionsItem[]
  selectedId: string

  ngOnInit () {
    this.buildScopeItems()
  }

  private buildScopeItems () {
    this.scopeItems = [
      { id: 'local', label: $localize`Only videos from this platform` },
      { id: 'federated', label: $localize`Videos from all platforms` }
    ]
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
