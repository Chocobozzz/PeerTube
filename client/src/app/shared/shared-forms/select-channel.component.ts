import { Component, Input, forwardRef, ViewChild } from '@angular/core'
import { NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms'
import { Actor } from '../shared-main'

@Component({
  selector: 'my-select-channel',
  styleUrls: [ './select-shared.component.scss' ],
  templateUrl: './select-channel.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectChannelComponent),
      multi: true
    }
  ]
})
export class SelectChannelComponent implements ControlValueAccessor {
  @Input() items: { id: number, label: string, support: string, avatarPath?: string }[] = []

  selectedId: number

  // ng-select options
  bindLabel = 'label'
  bindValue = 'id'
  clearable = false
  searchable = false

  get channels () {
    return this.items.map(c => Object.assign(c, {
      avatarPath: c.avatarPath ? c.avatarPath : Actor.GET_DEFAULT_AVATAR_URL()
    }))
  }

  propagateChange = (_: any) => { /* empty */ }

  writeValue (id: number) {
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
