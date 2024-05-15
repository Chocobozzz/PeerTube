// Thanks to https://github.com/brtnshrdr/angular2-hotkeys

import { Injectable, NgZone } from '@angular/core'
import { Hotkey } from './hotkey.model'
import { Subject } from 'rxjs'
import { tinykeys } from 'tinykeys'
import debug from 'debug'

const debugLogger = debug('peertube:hotkeys')

@Injectable()
export class HotkeysService {
  cheatSheetToggle = new Subject<boolean>()

  private hotkeys: Hotkey[] = []
  private preventIn = [ 'INPUT', 'SELECT', 'TEXTAREA' ]

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

            const target = event.target as Element
            const nodeName: string = target.nodeName.toUpperCase()

            if (this.preventIn.includes(nodeName)) {
              return
            }

            const result = hotkey.callback.apply(this, [ event, combo ])

            if (result === false) {
              event.preventDefault()
              event.stopPropagation()
            }
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
