
export interface EventHandler<T> {
    (ev : T) : void
}

export type PlayerEventType = 
    'playbackStateChanged'
    | 'ready'
;