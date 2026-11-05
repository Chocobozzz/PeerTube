// Thanks to https://github.com/brtnshrdr/angular2-hotkeys

import { Injectable, NgZone, inject } from '@angular/core'
import { getPhysicalLatinKey } from '@root-helpers/keyboard'
import debug from 'debug'
import { Subject } from 'rxjs'
import { createKeybindingsHandler } from 'tinykeys'
import { Hotkey } from './hotkey.model'

const debugLogger = debug('peertube:hotkeys')

@Injectable()
export class HotkeysService {
  private zone = inject(NgZone)

  cheatSheetToggle = new Subject<boolean>()

  private hotkeys: Hotkey[] = []
  private readonly preventInNode = new Set([ 'INPUT', 'SELECT', 'TEXTAREA' ])
  private readonly preventInRole = new Set([ 'combobox' ])

  private disabled = false

  private keybindingsHandlers = new Map<Hotkey, EventListener[]>()

  // Keep the original event, to give it to hotkey callbacks instead of the remapped one
  private readonly originalEvents = new WeakMap<object, KeyboardEvent>()

  constructor () {
    this.zone.runOutsideAngular(() => window.addEventListener('keydown', event => this.onKeyDown(event)))

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

      const handler = createKeybindingsHandler({
        [combo]: tinyKeysEvent => {
          if (this.disabled) return

          const event = this.originalEvents.get(tinyKeysEvent) ?? tinyKeysEvent

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

      if (!this.keybindingsHandlers.has(hotkey)) {
        this.keybindingsHandlers.set(hotkey, [])
      }

      this.keybindingsHandlers.get(hotkey).push(handler)
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

    if (this.keybindingsHandlers.delete(hotkey)) {
      debugLogger('Removing hotkey ' + hotkey.formatted)
    }
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

  private onKeyDown (event: KeyboardEvent) {
    const tinyKeysEvent = this.buildTinyKeysEvent(event)

    // Copy handlers, since a hotkey callback can add or remove hotkeys
    for (const handler of Array.from(this.keybindingsHandlers.values()).flat()) {
      handler(tinyKeysEvent)
    }
  }

  // tinykeys matches event.key, that is not a latin letter on non-latin keyboard layouts (cyrillic, greek...)
  // So give it the physical key instead in this case
  private buildTinyKeysEvent (event: KeyboardEvent): KeyboardEvent {
    if (!event.key || !event.code) return event

    const latinKey = getPhysicalLatinKey(event.key, event.code)
    if (!latinKey) return event

    // Only the properties read by tinykeys
    const tinyKeysEvent = {
      key: latinKey,
      code: event.code,
      repeat: event.repeat,
      isComposing: event.isComposing,
      target: event.target,
      currentTarget: event.currentTarget,
      getModifierState: (key: string) => event.getModifierState(key)
    } as KeyboardEvent

    this.originalEvents.set(tinyKeysEvent, event)

    return tinyKeysEvent
  }
}
