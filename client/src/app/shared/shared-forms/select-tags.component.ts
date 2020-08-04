import { Component, Input, forwardRef } from '@angular/core'
import { NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms'

@Component({
  selector: 'my-select-tags',
  styleUrls: [ './select-shared.component.scss', './select-tags.component.scss' ],
  templateUrl: './select-tags.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectTagsComponent),
      multi: true
    }
  ]
})
export class SelectTagsComponent implements ControlValueAccessor {
  @Input() items: string[] = []
  @Input() _items: string[] = []

  propagateChange = (_: any) => { /* empty */ }

  writeValue (items: string[]) {
    this._items = items
    this.propagateChange(this._items)
  }

  registerOnChange (fn: (_: any) => void) {
    this.propagateChange = fn
  }

  registerOnTouched () {
    // Unused
  }

  onModelChange () {
    this.propagateChange(this._items)
  }
}
