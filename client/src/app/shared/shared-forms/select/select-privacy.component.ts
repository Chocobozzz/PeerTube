import { Component, forwardRef, Input } from '@angular/core'
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms'
import { VideoPrivacy } from '@shared/models'
import { VideoConstant } from '@shared/models/videos/video-constant.model'

@Component({
  selector: 'my-select-privacy',
  templateUrl: './select-privacy.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectPrivacyComponent),
      multi: true
    }
  ]
})
export class SelectPrivacyComponent implements ControlValueAccessor {
  @Input() items: VideoConstant<VideoPrivacy>[] = []
  @Input() labelForId: string

  selectedId: number

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
