import { Injectable } from '@angular/core'
import { Subject } from 'rxjs'

@Injectable({ providedIn: 'root' })
export class PeertubeModalService {
  openQuickSettingsSubject = new Subject<void>()
}
