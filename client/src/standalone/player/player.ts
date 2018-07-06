import * as Channel from 'jschannel'
import { EventRegistrar } from './events';
import { EventHandler, PlayerEventType } from './definitions';

const SUPPORTED_EVENTS = [
    'pause', 'play', 
    'playbackStatusUpdate',
    'playbackStatusChange',
    'resolutionUpdate'
]

export interface PeerTubeResolution {
    id : any
    label : string
    src : string
    active : boolean
}
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
        this.eventRegistrar.registerTypes(SUPPORTED_EVENTS)

        this.constructChannel()
        this.prepareToBeReady()
    }

    private eventRegistrar : EventRegistrar = new EventRegistrar()
    private channel : Channel.MessagingChannel
    private currentPosition = 0

    public destroy() {
        this.embedElement.remove()
    }

    public addEventListener(event : PlayerEventType, handler : EventHandler<any>): boolean {
        return this.eventRegistrar.addListener(event, handler)
    }

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
    public get ready() {
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

    async play() {
        await this.sendMessage('play')
    }

    async pause() {
        await this.sendMessage('pause')
    }

    async setVolume(value : number) {
        await this.sendMessage('setVolume', value)
    }

    async seek(seconds : number) {
        await this.sendMessage('seek', seconds)
    }

    async setResolution(resolutionId : any) {
        await this.sendMessage('setResolution', resolutionId)
    }

    async getResolutions(): Promise<PeerTubeResolution[]> {
        return await this.sendMessage<void, PeerTubeResolution[]>('getResolutions')
    }

    async getPlaybackRates() : Promise<number[]> {
        return await this.sendMessage<void, number[]>('getPlaybackRates')
    }
    
    async getPlaybackRate() : Promise<number> {
        return await this.sendMessage<void, number>('getPlaybackRate')
    }

    async setPlaybackRate(rate : number) {
        await this.sendMessage('setPlaybackRate', rate)
    }
}

// put it on the window as well as the export
window['PeerTubePlayer'] = PeerTubePlayer;
