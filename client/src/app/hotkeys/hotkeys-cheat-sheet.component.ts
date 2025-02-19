import { Subscription } from 'rxjs'
import { Component, OnDestroy, OnInit, inject, input, output } from '@angular/core'
import { LocalStorageService, HotkeysService, Hotkey } from '@app/core'
import { FormsModule } from '@angular/forms'
import { PeertubeCheckboxComponent } from '../shared/shared-forms/peertube-checkbox.component'
import { NgClass, NgFor } from '@angular/common'

@Component({
  selector: 'my-hotkeys-cheat-sheet',
  templateUrl: './hotkeys-cheat-sheet.component.html',
  styleUrls: [ './hotkeys-cheat-sheet.component.scss' ],
  imports: [ NgClass, PeertubeCheckboxComponent, FormsModule, NgFor ]
})
export class HotkeysCheatSheetComponent implements OnInit, OnDestroy {
  private hotkeysService = inject(HotkeysService)
  private localStorage = inject(LocalStorageService)

  readonly title = input($localize`Keyboard Shortcuts`)

  readonly hotkeysModalStateChange = output<boolean>()

  hotkeysEnabled = true

  helpVisible = false
  subscription: Subscription

  hotkeys: Hotkey[]

  private readonly localStorageHotkeysDisabledKey = 'peertube-hotkeys-disabled'

  ngOnInit () {
    if (this.localStorage.getItem(this.localStorageHotkeysDisabledKey) === 'true') {
      this.hotkeysEnabled = false
      this.hotkeysService.disableHotkeys()
    }

    this.subscription = this.hotkeysService.cheatSheetToggle.subscribe(isOpen => {
      if (isOpen !== false) {
        this.hotkeys = this.hotkeysService.getHotkeys().filter(hotkey => hotkey.description)
      }

      if (isOpen === false) {
        this.helpVisible = false
      } else {
        this.toggleHelpVisible()
      }

      this.hotkeysModalStateChange.emit(this.helpVisible)
    })
  }

  ngOnDestroy () {
    if (this.subscription) {
      this.subscription.unsubscribe()
    }
  }

  toggleCheatSheet () {
    this.hotkeysService.cheatSheetToggle.next(!this.helpVisible)
  }

  toggleHelpVisible () {
    this.helpVisible = !this.helpVisible
  }

  onHotkeysEnabledChange () {
    if (!this.hotkeysEnabled) {
      this.localStorage.setItem(this.localStorageHotkeysDisabledKey, 'true')
      this.hotkeysService.disableHotkeys()
      return
    }

    this.hotkeysService.enableHotkeys()
    this.localStorage.removeItem(this.localStorageHotkeysDisabledKey)
  }
}
