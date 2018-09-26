import { Component, OnInit, OnDestroy, Input } from '@angular/core'
import { Subscription } from 'rxjs'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { HotkeysService, Hotkey } from 'angular2-hotkeys'

@Component({
  selector : 'my-hotkeys-cheatsheet',
  templateUrl : './hotkeys.component.html',
  styleUrls: [ './hotkeys.component.scss' ]
})
export class CheatSheetComponent implements OnInit, OnDestroy {
  @Input() title = this.i18n('Keyboard Shortcuts:')
  helpVisible = false
  subscription: Subscription

  hotkeys: Hotkey[]

  constructor (
    private hotkeysService: HotkeysService,
    private i18n: I18n
  ) {}

  public ngOnInit (): void {
    this.subscription = this.hotkeysService.cheatSheetToggle.subscribe((isOpen) => {
      if (isOpen !== false) {
        this.hotkeys = this.hotkeysService.hotkeys.filter(hotkey => hotkey.description)
      }

      if (isOpen === false) {
        this.helpVisible = false
      } else {
        this.toggleHelpVisible()
      }
    })
  }

  public ngOnDestroy (): void {
    if (this.subscription) {
      this.subscription.unsubscribe()
    }
  }

  public toggleCheatSheet (): void {
    this.hotkeysService.cheatSheetToggle.next(!this.helpVisible)
  }

  public toggleHelpVisible (): void {
    this.helpVisible = !this.helpVisible
  }
}
