import { Component, forwardRef, Input, OnChanges } from '@angular/core'
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms'
import { VideoChannel } from '@app/shared/shared-main'
import { SelectChannelItem } from '../../../../types/select-options-item.model'

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
export class SelectChannelComponent implements ControlValueAccessor, OnChanges {
  @Input() items: SelectChannelItem[] = []

  channels: SelectChannelItem[] = []
  selectedId: number

  // ng-select options
  bindLabel = 'label'
  bindValue = 'id'
  clearable = false
  searchable = false

  ngOnChanges () {
    this.channels = this.items.map(c => {
      const avatarPath = c.avatarPath
        ? c.avatarPath
        : VideoChannel.GET_DEFAULT_AVATAR_URL()

      return Object.assign({}, c, { avatarPath })
    })
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
