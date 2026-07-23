import { Component, OnInit, booleanAttribute, forwardRef, input, model, ChangeDetectionStrategy } from '@angular/core'
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms'
import { isMobile } from '@root-helpers/web-browser'
import { AutoCompleteModule } from 'primeng/autocomplete'

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
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [ AutoCompleteModule, FormsModule ]
})
export class SelectTagsComponent implements OnInit, ControlValueAccessor {
  readonly inputId = input.required<string>()
  readonly small = input(false, { transform: booleanAttribute })
  readonly selectedItems = model<string[]>([])
  readonly placeholder = model($localize`Enter a new tag`)

  separator: string

  ngOnInit () {
    // FIXME: workaround for https://github.com/primefaces/primeng/issues/13981
    if (isMobile()) {
      this.separator = ','
      this.placeholder.set($localize`Use a comma (,) to add a tag`)
    }
  }

  propagateChange = (_: any) => {
    // empty
  }

  writeValue (items: string[]) {
    this.selectedItems.set(items)
  }

  registerOnChange (fn: (_: any) => void) {
    this.propagateChange = fn
  }

  registerOnTouched () {
    // Unused
  }

  onModelChange () {
    this.propagateChange(this.selectedItems())
  }
}
