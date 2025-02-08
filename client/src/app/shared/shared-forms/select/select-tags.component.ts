import { CommonModule } from '@angular/common'
import { Component, Input, OnInit, forwardRef } from '@angular/core'
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms'
import { isMobile } from '@root-helpers/web-browser'
import { ChipsModule } from 'primeng/chips'

@Component({
  selector: 'my-select-tags',
  templateUrl: './select-tags.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectTagsComponent),
      multi: true
    }
  ],
  imports: [ CommonModule, ChipsModule, FormsModule ]
})
export class SelectTagsComponent implements OnInit, ControlValueAccessor {
  @Input({ required: true }) inputId: string
  @Input() availableItems: string[] = []
  @Input() selectedItems: string[] = []
  @Input() placeholder = $localize`Enter a new tag`

  separator: string

  ngOnInit () {
    // FIXME: workaround for https://github.com/primefaces/primeng/issues/13981
    if (isMobile()) {
      this.separator = ','
      this.placeholder = $localize`Use a comma (,) to add a tag`
    }
  }

  propagateChange = (_: any) => { /* empty */ }

  writeValue (items: string[]) {
    this.selectedItems = items
  }

  registerOnChange (fn: (_: any) => void) {
    this.propagateChange = fn
  }

  registerOnTouched () {
    // Unused
  }

  onModelChange () {
    this.propagateChange(this.selectedItems)
  }
}
