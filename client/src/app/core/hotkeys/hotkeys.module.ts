import { NgModule, ModuleWithProviders } from '@angular/core'
import { CommonModule } from '@angular/common'
import { HotkeysDirective, IHotkeyOptions, HotkeyOptions, HotkeysService } from 'angular2-hotkeys'
import { CheatSheetComponent } from './hotkeys.component'

export * from './hotkeys.component'

@NgModule({
  imports : [CommonModule],
  exports : [HotkeysDirective, CheatSheetComponent],
  declarations : [HotkeysDirective, CheatSheetComponent]
})
export class HotkeyModule {
  static forRoot (options: IHotkeyOptions = {}): ModuleWithProviders {
    return {
      ngModule : HotkeyModule,
      providers : [
        HotkeysService,
        { provide : HotkeyOptions, useValue : options }
      ]
    }
  }
}
