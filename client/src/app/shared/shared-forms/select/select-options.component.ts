import { CommonModule } from '@angular/common'
import {
  AfterContentInit,
  booleanAttribute,
  ChangeDetectorRef,
  Component,
  forwardRef,
  HostListener,
  numberAttribute,
  TemplateRef,
  inject,
  input,
  contentChildren
} from '@angular/core'
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms'
import { PeerTubeTemplateDirective } from '@app/shared/shared-main/common/peertube-template.directive'
import { DropdownModule } from 'primeng/dropdown'
import { SelectOptionsItem } from '../../../../types/select-options-item.model'

@Component({
  selector: 'my-select-options',

  templateUrl: './select-options.component.html',
  styleUrls: [ './select-options.component.scss' ],

  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectOptionsComponent),
      multi: true
    }
  ],
  imports: [ DropdownModule, FormsModule, CommonModule ]
})
export class SelectOptionsComponent implements AfterContentInit, ControlValueAccessor {
  private cd = inject(ChangeDetectorRef)

  readonly items = input<SelectOptionsItem[]>([])

  readonly inputId = input.required<string>()

  readonly clearable = input(false, { transform: booleanAttribute })
  readonly filter = input(false, { transform: booleanAttribute })

  readonly virtualScroll = input(false, { transform: booleanAttribute })
  readonly virtualScrollItemSize = input(39, { transform: numberAttribute })

  readonly templates = contentChildren(PeerTubeTemplateDirective)

  customItemTemplate: TemplateRef<any>

  selectedId: number | string
  disabled = false

  wroteValue: number | string

  ngAfterContentInit () {
    {
      const t = this.templates().find(t => t.name() === 'item')
      if (t) this.customItemTemplate = t.template
    }
  }

  propagateChange = (_: any) => {
    // empty
  }

  // Allow plugins to update our value
  @HostListener('change', [ '$event.target' ])
  handleChange (target: HTMLInputElement) {
    // Prevent the primeng search input to update our value
    if (target.role === 'searchbox') return

    this.writeValue(target.value)
    this.onModelChange()
  }

  writeValue (id: number | string) {
    this.selectedId = id

    // https://github.com/primefaces/primeng/issues/14609 workaround
    this.wroteValue = id
    this.cd.detectChanges()
  }

  registerOnChange (fn: (_: any) => void) {
    this.propagateChange = fn
  }

  registerOnTouched () {
    // Unused
  }

  onModelChange () {
    if (this.wroteValue !== undefined && this.wroteValue === this.selectedId) {
      return
    }

    this.wroteValue = undefined

    this.propagateChange(this.selectedId)
  }

  setDisabledState (isDisabled: boolean) {
    this.disabled = isDisabled
  }

  getSelectedItem () {
    return this.items().find(i => i.id === this.selectedId)
  }
}
