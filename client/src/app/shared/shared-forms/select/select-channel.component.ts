import { Component, forwardRef, Input } from '@angular/core'
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms'
import { VideoChannel } from '@app/shared/shared-main'

export type SelectChannelItem = {
  id: number
  label: string
  support: string
  avatarPath?: string
}

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
  @Input() items: SelectChannelItem[] = []

  selectedId: number

  // ng-select options
  bindLabel = 'label'
  bindValue = 'id'
  clearable = false
  searchable = false

  get channels () {
    return this.items.map(c => Object.assign(c, {
      avatarPath: c.avatarPath ? c.avatarPath : VideoChannel.GET_DEFAULT_AVATAR_URL()
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
