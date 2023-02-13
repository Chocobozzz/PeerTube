import './embed.scss'
import '../../assets/player/shared/dock/peertube-dock-component'
import '../../assets/player/shared/dock/peertube-dock-plugin'
import videojs from 'video.js'
//import { peertubeTranslate } from '../../../../shared/core-utils/i18n'
import { HTMLServerConfig, LiveVideo, VideoDetails } from '../../../../shared/models'
import { PeertubePlayerManager } from '../../assets/player'
import { logger } from '../../root-helpers'
import { PeerTubeEmbedApi } from "./api-direct";
import { AuthHTTP, LiveManager, PlayerManagerOptions, VideoFetcher } from './shared'
import { PlayerHTML } from './shared/player-html'
require("videojs-overlay");

var {P2PMediaManager} = require ('p2p-media-loader-core-basyton/dist/p2p-media-manager')

export class PeerTubeEmbed {
	player: videojs.Player
	details : VideoDetails
	api: PeerTubeEmbedApi = null
	statusInterval : any
	listenAudioInterval : any
	lightclbk : Function
	pathfunction: any
	config: HTMLServerConfig
	parameters : any
	clbk : any
	//host: string

	private PeertubePlayerManagerModulePromise: Promise<any>

	private readonly http: AuthHTTP
	private readonly videoFetcher: VideoFetcher
	private readonly playerHTML: PlayerHTML
	private readonly playerManagerOptions: PlayerManagerOptions
	private readonly liveManager: LiveManager


	constructor(wrapperElement: HTMLElement) {

		this.http = new AuthHTTP()

		this.videoFetcher = new VideoFetcher(this.http)
		this.playerHTML = new PlayerHTML(wrapperElement)


		this.playerManagerOptions = new PlayerManagerOptions(this.playerHTML, this.videoFetcher)
		this.liveManager = new LiveManager(this.playerHTML)

		/*try {
			this.config = JSON.parse(window['PeerTubeServerConfig'])
		} catch (err) {
			logger.error('Cannot parse HTML config.', err)
		}*/
	}

	static async main(
		element: HTMLElement,
		videoId: string,
		host : string,
		parameters: any,
		clbk: any
	) {
		const embed = new PeerTubeEmbed(element)

		return await embed.init(host, videoId, parameters, clbk).then(() => {
			return Promise.resolve(embed);
		})
	}

	getPlayerElement() {
		return this.playerHTML.getPlayerElement()
	}

	public async getplayer(){

		if (this.lightclbk){
			await this.lightclbk()
		}

		return this.player
	}

	getScope() {
		return this.playerManagerOptions.getScope()
	}

	// ---------------------------------------------------------------------------

	async init(host: string, videoId: string, parameters: any, clbk : any) {
		this.PeertubePlayerManagerModulePromise = import('../../assets/player/peertube-player-manager')

		if (!videoId || !host) return

		return this.loadVideoAndBuildPlayer(host, videoId, parameters, clbk)
	}

	private initializeApi(clbk : any = {}) {

		if (this.api) {
			this.api.clear()
			this.api.setupStateTracking()
		}
		else {
			this.api = new PeerTubeEmbedApi(this, clbk);
			this.api.initialize();
		}
	}

	/// ?

	/*private correctPath(path: string = '') {

		if (this.pathfunction) return this.pathfunction(path)

		return path
	}

	private composePath(path: string = '') {

		var h = this.host

		if (this.pathfunction) h = this.pathfunction(h)

		else h = 'https://' + h

		return h + path

	}*/

	/*public getelement() {
		var pel = this.playerHTML.getPlayerElement();

		try {
			pel = this.player.tech.el
		} catch (e) { }

		return pel
	}*/

	// ---------------------------------------------------------------------------

	private async loadVideoAndBuildPlayer(host: string, uuid: string, parameters: any, clbk : any) {
		try {
			const { videoDetails } = await this.videoFetcher.loadVideoCache(uuid, host)

			videoDetails.host = host

			const pipMiniElem = this.playerHTML.getWrapperElement().closest('.pipmini')
			const pipModeElem = this.playerHTML.getWrapperElement().closest('.pipmode')
			parameters.isPip = (pipMiniElem != undefined || pipModeElem != undefined);
			
			if (parameters.light){

				return this.buildVideoPlayerLight(videoDetails, async () => {
					parameters.wasLight = true;
					await this.buildVideoPlayer(videoDetails, host, parameters, clbk)
				}, parameters, clbk);
	
			}

			return this.buildVideoPlayer(videoDetails, host, parameters, clbk)
		} catch (err) {
			
			this.playerHTML.displayError(err.message/*, await this.translationsPromise*/)

			this.initializeApi(clbk)
		}
	}

	private async buildVideoPlayerLight(videoDetails: VideoDetails,clbk : Function, parameters : any, aclbk: any){
		parameters.lighted = true

		this.initializeApi(aclbk);

		var poster = this.playerHTML.thumbPlayer(videoDetails, true)

		poster.addEventListener('click', () => {

			if (this.lightclbk)
				this.lightclbk().then(() => {
					this.player.play()
				})

		})

		this.lightclbk = async () => {

			parameters.lighted = false

			this.playerHTML.removeErrorBlock()

			this.lightclbk = null;

			await clbk()

		}
	}

	private async checkInfo(ca : Function) {

		if (this.details && ca(this.details)) {

			return this.videoFetcher.loadVideoTotal(this.details.uuid, this.details.host).then(({videoDetails}) => {


				if (!videoDetails) return Promise.reject()

				videoDetails.host = this.details.host

				this.details = videoDetails

				if (ca(videoDetails)) {
					return Promise.reject()
				}
				else {

					return Promise.resolve(true)
				}

			}).catch(e => {
				return Promise.reject()
			})

		}

		return Promise.resolve()
	}

	private stopWaiting(){
		if(this.statusInterval){
			clearInterval(this.statusInterval)
			this.statusInterval = null
		}
	}

	private stopListening(){
		if(this.listenAudioInterval){
			clearInterval(this.listenAudioInterval)
			this.listenAudioInterval = null
		}
	}

	private async waitStatus(statuses : Array<Number>){
		return this.checkInfo(function(details : any){

			if(!details || !details.state) return true

			if (statuses.indexOf(details.state.id) > -1){
				return true
			}
		})
	}

	private initWaiting(host : any, parameters: any, clbk : any){
		this.stopWaiting()

		this.statusInterval = setInterval(() => {
			// @ts-ignore
			this.waitStatus([2, 4, 5]).then((r: any) => {

				clearInterval(this.statusInterval)
				
				this.statusInterval = null


				if (r){


					this.buildVideoPlayer(this.details, host, parameters, clbk)

					/*this.loadVideoAndBuildPlayer(this.details.uuid).catch((err) => console.error(err));

					if (this.errorBlock){
						this.wrapperElement.removeChild(this.errorBlock);
					}*/
				}
				 	


			}).catch((e : any) => {
			})

		}, 30000)
	}

	private async buildVideoPlayer(videoDetails: VideoDetails, host : any, parameters: any, clbk : any) {
		const alreadyHadPlayer = this.resetPlayerElement(videoDetails)

		this.playerHTML.removeErrorBlock()
		
		const videoInfoPromise: Promise<{ video: VideoDetails, live?: LiveVideo }> = new Promise((resolve, reject) => {
			
			this.details = videoDetails
			this.parameters = parameters
			this.clbk = clbk

			this.playerManagerOptions.loadParams(videoDetails, parameters)

			/*if (!alreadyHadPlayer && !this.playerManagerOptions.hasAutoplay()) {
				this.playerHTML.buildPlaceholder(videoDetails, host)
			}*/

			if (!videoDetails.isLive) {
				return resolve({ video: videoDetails })
			}

			return this.videoFetcher.loadVideoWithLive(videoDetails, host).then(resolve).catch(reject)
		})
		

		const [{ video, live }, PeertubePlayerManagerModule] = await Promise.all([
			videoInfoPromise,
			/*this.translationsPromise,
			captionsPromise,*/
			this.PeertubePlayerManagerModulePromise
		])


		if(video){

			var statuses = [2, 4, 5]


			if (statuses.indexOf(video.state.id) > -1){

				this.playerHTML.thumbPlayer(videoDetails, false)
				this.playerHTML.transcodingMessage(videoDetails.isAudio || false)

				this.initWaiting(host, parameters, clbk)

				return
			}
		}


		const PlayerManager: typeof PeertubePlayerManager = PeertubePlayerManagerModule.PeertubePlayerManager
		const options = await this.playerManagerOptions.getPlayerOptions({
			video,
			//captionsResponse,
			alreadyHadPlayer,
			//translations,
			serverConfig: this.config,

			onVideoUpdate: (uuid: string, host) => this.loadVideoAndBuildPlayer(host, uuid, parameters, clbk),

			//playNextPlaylistVideo: () => this.playNextPlaylistVideo(),
			//playPreviousPlaylistVideo: () => this.playPreviousPlaylistVideo(),

			live,

			poster: !parameters.localVideo ? null : parameters.localVideo.infos.thumbnail,

			sources: !parameters.localVideo ? null : [{
				src:  parameters.localVideo.video.internalURL,
				type: 'video/mp4',
				size: parseInt(parameters.localVideo.video.name)
			}]
		})

		if (videoDetails && videoDetails.isAudio == true)
			options.isAudio = true;

		this.player = await PlayerManager.initialize(this.playerManagerOptions.getMode(), options, (player: videojs.Player) => {
			this.player = player
		})

		if (videoDetails && videoDetails.isAudio == true && parameters.isPip != true && parameters.wasLight != true) {
			this.player.play()?.then(() => {
				this.player.pause();
				if (this.player.muted())
					this.player.muted(false);
			});
		}

		this.player.on('customError', (event: any, data: any) => {
			const message = data?.err?.message || ''
			if (!message.includes('from xs param')) return

			this.player.dispose()
			this.playerHTML.removePlayerElement()
			this.playerHTML.displayError('This video is not available because the remote instance is not responding.')

			this.api.send({ 
				method: 'error', 
				params: {
					message: 'This video is not available because the remote instance is not responding.'
				}
			})
		})

		// Fix an issue on mobile, where the video pause itself after moving to another time
		if (videoDetails && videoDetails.isAudio == true) {
			this.player.on('seeked', () => {
				setTimeout(() => {
					if (this.player.paused()) {
						this.player.play();
					}
				}, 100);
			});
		}

		//window['videojsPlayer'] = this.player

		//this.buildCSS()
		//this.buildPlayerDock(video)

		const overlayString = '<span class="icon logo-bastyon"></span>';

		this.player.overlay({
			overlays: [
				{
					content: overlayString,
					align: "top-left",
					start: 0,
					showBackground: false,
					class: "pocketnet-logo-video-player",
				},
			],
		});

		if (this.api && this.api.playing){
			this.player.play()
		}

		this.initializeApi(clbk)

		// @ts-ignore
		this.playerHTML.setARElement(video, this.player.el_)

		// @ts-ignore
		if (window.cordova) {
			try{
				// @ts-ignore
				(this.player.tech_.el_ || this.player.el_).setAttribute('poster', options.common.poster);
			}catch(e){
				console.error(e)
			}
			
		}

		//if (this.isPlaylistEmbed()) {
		//await this.buildPlayerPlaylistUpnext()

		//this.player.playlist().updateSelected()

		/*this.player.on('stopped', () => {
		  this.playNextPlaylistVideo()
		})*/
		//}

		//this.peertubePlugin.getPluginsManager().runHook('action:embed.player.loaded', undefined, { player: this.player, videojs, video })

		if (video.isLive) {
			this.liveManager.displayInfoAndListenForChanges({
				video,
				onPublishedVideo: () => {
					this.liveManager.stopListeningForChanges(video)
					this.loadVideoAndBuildPlayer(video.host, video.uuid, parameters, clbk) //// +
				}
			})
		}
	}

	private resetPlayerElement(videoDetails: VideoDetails) {
		let alreadyHadPlayer = false
		var self = this;

		if (this.player) {
			this.player.dispose()
			alreadyHadPlayer = true
		}

		const playerElement = document.createElement('video')
		playerElement.className = 'video-js vjs-peertube-skin'
		playerElement.setAttribute('playsinline', 'true')

		// Check audio file
		if (videoDetails.isAudio) {

			// Start an audio contect to listen to audio
			var context = new AudioContext();
			var src = context.createMediaElementSource(playerElement);
			var analyser = context.createAnalyser();
			src.connect(analyser);
			analyser.connect(context.destination);
			analyser.fftSize = 1024;
			var bufferLength = analyser.frequencyBinCount;
			var dataArray = new Uint8Array(bufferLength);

			// Create a canvas to show the audio visualization
			const audioVisu = document.createElement('canvas')
			audioVisu.className = 'vjs-audio-visualization';
			var ctx = audioVisu.getContext('2d');
			var canvasAdded = false;

			// Create a div to show the audio wallpaper
			/*
			const audioWallpaper = document.createElement('div')
			audioWallpaper.className = 'vjs-audio-wallpaper';
			const thumbnailUrl = (videoDetails.from ? 'https://' + videoDetails.from : videoDetails.host) + videoDetails.thumbnailPath;
			audioWallpaper.style.backgroundImage = 'url(' + thumbnailUrl + ')';
			const playerWrapperSize = this.playerHTML.getWrapperSize();
			if (playerWrapperSize && playerWrapperSize.height) {
				audioWallpaper.style.width = playerWrapperSize.height + 'px';
				audioWallpaper.style.height = playerWrapperSize.height + 'px';
			}
			*/

			// Setup events to know when mouse is over the player
			this.playerHTML.getWrapperElement().onmouseover = function() {
				audioVisu['mouseOver'] = true;
			}
			this.playerHTML.getWrapperElement().onmouseout = function() {
				audioVisu['mouseOver'] = false;
			}
			// Setup events when mouse is clicked over the player visualization and wallpaper
			var togglePlayerPlay = function() {
				if (self.player) {
					if (self.player.paused())
						self.player.play();
					else
						self.player.pause();
				}
			}
			audioVisu.onclick = togglePlayerPlay;
			// audioWallpaper.onclick = togglePlayerPlay;

			this.stopListening();
			// Start listening to audio
			this.listenAudioInterval = setInterval(() => {

				const pipMiniElem = this.playerHTML.getWrapperElement().closest('.pipmini')
				const pipModeElem = this.playerHTML.getWrapperElement().closest('.pipmode')
				const isPip = (pipMiniElem != undefined || pipModeElem != undefined);

				const wrapperSize = this.playerHTML.getWrapperSize();

				if (!ctx || !wrapperSize)
					return

				// audioWallpaper.style.width = ((isPip) ? 0 : wrapperSize.height) + 'px';
				// audioWallpaper.style.height = ((isPip) ? 0 : wrapperSize.height) + 'px';

				// Add the canvas to the video player DOM if needed
				if (!canvasAdded && playerElement.parentElement) {
					this.playerHTML.addElementToDOM(audioVisu);
					// this.playerHTML.addElementToDOM(audioWallpaper);
					canvasAdded = true;
				}
				if (!canvasAdded)
					return;

				const isMobileView = (this.playerHTML.getWrapperElement().closest('html.mobileview') != undefined);

				audioVisu.height = wrapperSize.height;

				// If not on mobile, move the visualization on top of the control bar
				/*
				if (!isMobileView && !isPip)
					audioVisu.height -= 63;
				audioVisu.width = (isPip) ? wrapperSize.width : wrapperSize.width - wrapperSize.height;
				*/
				audioVisu.width = wrapperSize.width;

				audioVisu.style.width = audioVisu.width + 'px';
				audioVisu.style.height = audioVisu.height + 'px';
				var WIDTH = audioVisu.width;
				var HEIGHT = audioVisu.height;

				analyser.getByteFrequencyData(dataArray);

				// Show / hide the visualization if needed
				const noSound = (dataArray.reduce((partialSum, value) => partialSum + value, 0) <= 0)
				if (noSound || audioVisu['mouseOver'] == true) {
					const thumbnailUrl = (videoDetails.from ? 'https://' + videoDetails.from : videoDetails.host) + videoDetails.thumbnailPath;
					audioVisu.style.backgroundImage = 'url(' + thumbnailUrl + ')';
					audioVisu.style.backgroundPosition = 'center';
					audioVisu.style.backgroundRepeat = 'no-repeat';
					audioVisu.style.backgroundSize = 'cover';
					/*
					setTimeout(() => {
						if (audioVisu['mouseOver'])
							audioVisu.style.visibility = 'hidden';
					}, 300);
					audioVisu.classList.add('hide-visualization');
					*/
				} else {
					/*
					audioVisu.style.visibility = 'visible';
					audioVisu.classList.remove('hide-visualization');
					*/
					audioVisu.style.backgroundImage = 'none';

					// Bar visualization
					// analyser.getByteFrequencyData(dataArray);
					ctx.fillStyle = "transparent";
					ctx.fillRect(0, 0, WIDTH, HEIGHT);
					const barWidth = (WIDTH / bufferLength) * 2;
					let barHeight;
					let barHeightPourcentage;
					let x = 0;
					let maxValue = 255;
					for (let i = 0; i < bufferLength; i++) {
						barHeightPourcentage = dataArray[i] / maxValue;
						barHeight = HEIGHT * barHeightPourcentage;
						ctx.fillStyle = `rgb(0, 166, 255)`;
						ctx.fillRect(x, HEIGHT - barHeight, barWidth, barHeight)
						x += barWidth + 1;
					}
					ctx.stroke();

				}

				// Oscilloscope visualization
				/*
				analyser.getByteTimeDomainData(dataArray);
				var segmentWidth = WIDTH / analyser.frequencyBinCount;
				ctx.fillStyle = "#011621";
				ctx.strokeStyle = "#00a6ff";
				ctx.lineWidth = 2;
				ctx.fillRect(0, 0, WIDTH, HEIGHT);
				ctx.beginPath();
				ctx.moveTo(-100, HEIGHT / 2);
				for (let i = 1; i < analyser.frequencyBinCount; i += 1) {
					let x = i * segmentWidth;
					let v = dataArray[i] / 128.0;
					let y = (v * HEIGHT) / 2;
					ctx.lineTo(x, y);
				}
				ctx.lineTo(WIDTH + 100, HEIGHT / 2);
				ctx.stroke();
				*/

			}, 10);

		}

		this.playerHTML.setPlayerElement(playerElement)
		this.playerHTML.addPlayerElementToDOM()

		return alreadyHadPlayer
	}

	rebuild() {

		this.destroy()

		if (this.details && this.details.uuid) {
			return this.loadVideoAndBuildPlayer(this.details.host, this.details.uuid, this.parameters, this.clbk)
		}

		return Promise.resolve()
	}


	destroy(){

		this.stopWaiting()

		this.stopListening()

		if (this.player){
			try{this.player.dispose()} catch(e){}
		}

		if (this.api){
			this.api.clear()
		}
	}

}

/*
PeerTubeEmbed.main()
  .catch(err => {
	(window as any).displayIncompatibleBrowser()

	logger.error('Cannot init embed.', err)
  })
*/

// @ts-ignore
window.PeerTubeEmbeding = PeerTubeEmbed; window.P2PMediaManager = P2PMediaManager