import { OutputEmitterRef } from '@angular/core'

export interface CustomMarkupComponent {
  loaded: OutputEmitterRef<boolean> | undefined
}
