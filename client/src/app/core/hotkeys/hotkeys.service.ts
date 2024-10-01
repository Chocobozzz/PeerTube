// Thanks to https://github.com/brtnshrdr/angular2-hotkeys

import { Injectable, NgZone } from '@angular/core'
import debug from 'debug'
import { Subject } from 'rxjs'
import { tinykeys } from 'tinykeys'
import { Hotkey } from './hotkey.model'

const debugLogger = debug('peertube:hotkeys')

@Injectable()
export class HotkeysService {
  cheatSheetToggle = new Subject<boolean>()

  private hotkeys: Hotkey[] = []
  private readonly preventInNode = new Set([ 'INPUT', 'SELECT', 'TEXTAREA' ])
  private readonly preventInRole = new Set([ 'combobox' ])

  private disabled = false

  private removeTinyKeysStore = new Map<Hotkey, (() => void)[]>()

  constructor (private zone: NgZone) {
    this.initCheatSheet()
  }

  private initCheatSheet () {
    debugLogger('Init hotkeys')

    this.add([
      new Hotkey(
        [ '?', 'Shift+?' ],
        () => this.cheatSheetToggle.next(undefined),
        $localize`Show / hide this help menu`
      ),

      new Hotkey(
        'escape',
        () => this.cheatSheetToggle.next(false),
        $localize`Hide this help menu`
      )
    ])
  }

  add (hotkey: Hotkey): Hotkey
  add (hotkey: Hotkey[]): Hotkey[]
  add (hotkey: Hotkey | Hotkey[]): Hotkey[] | Hotkey {
    if (Array.isArray(hotkey)) {
      return hotkey.map(h => this.add(h))
    }

    this.remove(hotkey)
    this.hotkeys.push(hotkey)

    for (const combo of hotkey.combo) {
      debugLogger('Adding hotkey ' + hotkey.formatted)

      this.zone.runOutsideAngular(() => {
        const removeTinyKey = tinykeys(window, {
          [combo]: event => {
            if (this.disabled) return

            const target = event.target as HTMLElement
            const nodeName: string = target.nodeName.toUpperCase()

            if (target.isContentEditable || this.preventInNode.has(nodeName) || this.preventInRole.has(target.getAttribute('role'))) {
              return
            }

            this.zone.run(() => {
              const result = hotkey.callback.apply(this, [ event, combo ])

              if (result === false) {
                event.preventDefault()
                event.stopPropagation()
              }
            })
          }
        })

        if (!this.removeTinyKeysStore.has(hotkey)) {
          this.removeTinyKeysStore.set(hotkey, [])
        }

        this.removeTinyKeysStore.get(hotkey).push(removeTinyKey)
      })
    }

    return hotkey
  }

  remove (hotkey: Hotkey | Hotkey[]) {
    if (Array.isArray(hotkey)) {
      for (const h of hotkey) {
        this.remove(h)
      }

      return
    }

    this.hotkeys = this.hotkeys.filter(h => h !== hotkey)
    const removeHandlers = this.removeTinyKeysStore.get(hotkey)

    if (removeHandlers) {
      debugLogger('Removing hotkey ' + hotkey.formatted)

      for (const removeHandler of removeHandlers) {
        removeHandler()
      }
    }

    this.removeTinyKeysStore.delete(hotkey)
  }

  getHotkeys () {
    return this.hotkeys
  }

  disableHotkeys () {
    this.disabled = true
  }

  enableHotkeys () {
    this.disabled = false
  }
}
