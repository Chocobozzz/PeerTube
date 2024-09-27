import { Component, forwardRef, Input, OnChanges } from '@angular/core'
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms'
import { SelectChannelItem } from '../../../../types/select-options-item.model'
import { NgFor } from '@angular/common'
import { NgSelectModule } from '@ng-select/ng-select'
import { VideoChannel } from '@app/shared/shared-main/channel/video-channel.model'

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
  ],
  standalone: true,
  imports: [ NgSelectModule, FormsModule, NgFor ]
})
export class SelectChannelComponent implements ControlValueAccessor, OnChanges {
  @Input({ required: true }) labelForId: string
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
        : VideoChannel.GET_DEFAULT_AVATAR_URL(20)

      return Object.assign({}, c, { avatarPath })
    })
  }

  propagateChange = (_: any) => { /* empty */ }

  writeValue (id: number | string) {
    this.selectedId = typeof id === 'string'
      ? parseInt(id, 10)
      : id
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
