import { Injectable } from '@angular/core'

@Injectable({ providedIn: 'root' })
export class RouterStatusService {
  isNavigatingBack = false
}
