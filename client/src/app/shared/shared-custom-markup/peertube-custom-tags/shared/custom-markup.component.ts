import { EventEmitter } from '@angular/core'

export interface CustomMarkupComponent {
  loaded: EventEmitter<boolean> | undefined
}
