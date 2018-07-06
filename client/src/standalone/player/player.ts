import * as Channel from 'jschannel'
import { EventRegistrar } from './events'
import { EventHandler, PlayerEventType, PeerTubeResolution } from './definitions'

const PASSTHROUGH_EVENTS = [
    'pause', 'play', 
    'playbackStatusUpdate',
    'playbackStatusChange',
    'resolutionUpdate'
]

/**
 * Allows for programmatic control of a PeerTube embed running in an <iframe> within a web page.
 */
export class PeerTubePlayer {
    /**
     * Construct a new PeerTubePlayer for the given PeerTube embed iframe.
     * Optionally provide a `scope` to ensure that messages are not crossed 
     * between multiple PeerTube embeds. The string passed here must match the 
     * `scope=` query parameter on the embed URL.
     * 
     * @param embedElement 
     * @param scope 
     */
    constructor(
        private embedElement : HTMLIFrameElement, 
        private scope? : string
    ) {
        this.eventRegistrar.registerTypes(PASSTHROUGH_EVENTS)

        this.constructChannel()
        this.prepareToBeReady()
    }

    private eventRegistrar : EventRegistrar = new EventRegistrar()
    private channel : Channel.MessagingChannel
    private currentPosition = 0

    /**
     * Destroy the player object and remove the associated player from the DOM.
     */
    public destroy() {
        this.embedElement.remove()
    }

    /**
     * Listen to an event emitted by this player.
     * 
     * @param event One of the supported event types
     * @param handler A handler which will be passed an event object (or undefined if no event object is included)
     */
    public addEventListener(event : PlayerEventType, handler : EventHandler<any>): boolean {
        return this.eventRegistrar.addListener(event, handler)
    }

    /**
     * Remove an event listener previously added with addEventListener().
     * 
     * @param event The name of the event previously listened to
     * @param handler 
     */
    public removeEventListener(event : PlayerEventType, handler : EventHandler<any>): boolean {
        return this.eventRegistrar.removeListener(event, handler)
    }
    
    private constructChannel() {
        this.channel = Channel.build({
            window: this.embedElement.contentWindow,
            origin: '*',
            scope: this.scope || 'peertube'
        })
        this.eventRegistrar.bindToChannel(this.channel)
    }
 
    private _readyPromise : Promise<void>
    private prepareToBeReady() {
        let readyResolve, readyReject
        this._readyPromise = new Promise<void>((res, rej) => {
            readyResolve = res
            readyReject = rej
        })
        
        this.channel.bind('ready', success => success ? readyResolve() : readyReject())
        this.channel.call({
            method: 'isReady',
            success: isReady => isReady ? readyResolve() : null
        })
    }

    /**
     * Promise resolves when the player is ready.
     */
    public get ready(): Promise<void> {
        return this._readyPromise
    }

    private sendMessage<TIn, TOut>(method : string, params? : TIn): Promise<TOut> {
        return new Promise<TOut>((resolve, reject) => {
            this.channel.call({
                method, params,
                success: result => resolve(result),
                error: error => reject(error)
            })
        })
    }

    /**
     * Tell the embed to start/resume playback
     */
    async play() {
        await this.sendMessage('play')
    }

    /**
     * Tell the embed to pause playback.
     */
    async pause() {
        await this.sendMessage('pause')
    }

    /**
     * Tell the embed to change the audio volume
     * @param value A number from 0 to 1
     */
    async setVolume(value : number) {
        await this.sendMessage('setVolume', value)
    }

    /**
     * Tell the embed to seek to a specific position (in seconds)
     * @param seconds 
     */
    async seek(seconds : number) {
        await this.sendMessage('seek', seconds)
    }

    /**
     * Tell the embed to switch resolutions to the resolution identified
     * by the given ID.
     * 
     * @param resolutionId The ID of the resolution as found with getResolutions()
     */
    async setResolution(resolutionId : any) {
        await this.sendMessage('setResolution', resolutionId)
    }

    /**
     * Retrieve a list of the available resolutions. This may change later, listen to the 
     * `resolutionUpdate` event with `addEventListener` in order to be updated as the available
     * resolutions change.
     */
    async getResolutions(): Promise<PeerTubeResolution[]> {
        return await this.sendMessage<void, PeerTubeResolution[]>('getResolutions')
    }

    /**
     * Retrieve a list of available playback rates. 
     */
    async getPlaybackRates() : Promise<number[]> {
        return await this.sendMessage<void, number[]>('getPlaybackRates')
    }
    
    /**
     * Get the current playback rate. Defaults to 1 (1x playback rate).
     */
    async getPlaybackRate() : Promise<number> {
        return await this.sendMessage<void, number>('getPlaybackRate')
    }

    /**
     * Set the playback rate. Should be one of the options returned by getPlaybackRates().
     * Passing 0.5 means half speed, 1 means normal, 2 means 2x speed, etc.
     * 
     * @param rate 
     */
    async setPlaybackRate(rate : number) {
        await this.sendMessage('setPlaybackRate', rate)
    }
}

// put it on the window as well as the export
window['PeerTubePlayer'] = PeerTubePlayer