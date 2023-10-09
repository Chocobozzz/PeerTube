// Thanks to https://github.com/brtnshrdr/angular2-hotkeys

import { arrayify } from '@peertube/peertube-core-utils'

export class Hotkey {
  private formattedHotkey: string[]

  static symbolize (combo: string): string {
    const map: any = {
      command: '\u2318', // ⌘
      shift: '\u21E7', // ⇧
      left: '\u2190', // ←
      right: '\u2192', // →
      up: '\u2191', // ↑
      down: '\u2193', // ↓
      return: '\u23CE', // ⏎
      backspace: '\u232B' // ⌫
    }
    const comboSplit: string[] = combo.split('+')

    for (let i = 0; i < comboSplit.length; i++) {
      // try to resolve command / ctrl based on OS:
      if (comboSplit[i] === 'mod') {
        if (window.navigator?.platform.includes('Mac')) {
          comboSplit[i] = 'command'
        } else {
          comboSplit[i] = 'ctrl'
        }
      }

      comboSplit[i] = map[comboSplit[i]] || comboSplit[i]
    }

    return comboSplit.join(' + ')
  }

  constructor (
    public combo: string | string[],
    public callback: (event: KeyboardEvent, combo: string) => any | boolean,
    public description?: string | Function
  ) {
    this.combo = arrayify(combo)
    this.description = description || ''
  }

  get formatted (): string[] {
    if (!this.formattedHotkey) {
      const sequence: string[] = [ ...this.combo ]

      for (let i = 0; i < sequence.length; i++) {
        sequence[i] = Hotkey.symbolize(sequence[i])
      }

      this.formattedHotkey = sequence
    }

    return this.formattedHotkey
  }
}
