import { peertubeTranslate } from '../../../../../shared/core-utils/i18n'
import { VideoDetails } from '../../../../../shared/models'
import { logger } from '../../../root-helpers'
import { Translations } from './translations'

export class PlayerHTML {
  private readonly wrapperElement: HTMLElement

  private playerElement: HTMLVideoElement
  private informationElement: HTMLDivElement
  private errorBlock : HTMLDivElement

  constructor (wrapperElement: HTMLElement) {
    this.wrapperElement = wrapperElement //document.getElementById(this.videoWrapperId)
  }

  getPlayerElement () {
    return this.playerElement
  }

  setPlayerElement (playerElement: HTMLVideoElement) {
    this.playerElement = playerElement
  }

  removePlayerElement () {
    this.playerElement = null
  }

  removeErrorBlock(){
	console.log('this.errorBlock', this.errorBlock)
	if (this.errorBlock){
		this.wrapperElement.removeChild(this.errorBlock);
	}
  }

  addPlayerElementToDOM () {
    this.wrapperElement.appendChild(this.playerElement)
  }

  displayError (text: string, style : string = "noncritical" /* translations: Translations*/) {
    logger.error(text)

	console.log('text', text)

    const errorBlock = document.createElement("div");
		errorBlock.className = "error-block " + style;

		const errorBlockWrapper = document.createElement("div");
		errorBlockWrapper.className = "error-block-wrapper";

		const errorTitle = document.createElement("div");
		errorTitle.className = "error-title";
		errorTitle.innerHTML = "Sorry";

		const errorText = document.createElement("div");
		errorText.className = "error-text";
		errorText.innerHTML = text;

		errorBlock.appendChild(errorBlockWrapper);
		errorBlockWrapper.appendChild(errorTitle);
		errorBlockWrapper.appendChild(errorText);

		/*if (this.details && this.details.uuid) {

			const errorReload = document.createElement("button");
			errorReload.className = "error-reload";
			errorReload.innerHTML = `<i class="fas fa-redo"></i> ${is_transcoding ? "Keep watching" : "Reload"}`;

			errorReload.onclick = () => {
				this.wrapperElement.removeChild(errorBlock);
				this.playnottranscoded = true;
				this.loadVideoTotal(this.details.uuid).then((r) => {
					this.loadVideoAndBuildPlayer(this.details.uuid);
				});
				this.errorBlock = null;
			};

			errorBlockWrapper.appendChild(errorReload);
		}*/

		this.errorBlock = errorBlock;

		this.wrapperElement.appendChild(errorBlock);
		this.wrapperElement.setAttribute('error', style)

    this.deleteLoadingPlaceholder()
  }

  /*buildPlaceholder (video: VideoDetails, host : string) {
    const placeholder = this.getPlaceholderElement()

    const url = host + video.previewPath
    placeholder.style.backgroundImage = `url("${url}")`
    placeholder.style.display = 'block'
  }

  removePlaceholder () {
    const placeholder = this.getPlaceholderElement()
    placeholder.style.display = 'none'
  }*/

  displayInformation (text: string) {
    if (this.informationElement) this.removeInformation()

    this.informationElement = document.createElement('div')
    this.informationElement.className = 'player-information'
    this.informationElement.innerText = text

    document.body.appendChild(this.informationElement)
  }

  removeInformation () {
    this.removeElement(this.informationElement)
  }

  thumbImage(src){
	var image = new Image()

	return new Promise((resolve : any, reject : any) => {

		var resolved = false
		var c = function(){
			if(!resolved){
				resolve()
			}

			resolved = true
		}
		image.src = src
		image.onload = () => {
			c()
		}

		image.onerror = () => {
			c()
		}

		setTimeout(() => {
			c()
		}, 1000)

	})
	
  }

  thumbPlayer(videoInfo: VideoDetails, addplaybutton : Boolean){
	
	const url = (videoInfo.from ? 'https://' + videoInfo.from : videoInfo.host) + videoInfo.previewPath

	var poster = document.createElement("div");
		poster.className = "vjs-thumb video-js";
		poster.style.backgroundImage = 'url('+url+')'
		

	var aslayer = this.createARElement(videoInfo)
		poster.appendChild(aslayer)

	if (addplaybutton){
		var playbutton = document.createElement("button");
		playbutton.className = "vjs-big-play-button";
		playbutton.innerHTML='<span class="vjs-icon-placeholder"></span>'

		poster.appendChild(playbutton)
	}


	this.wrapperElement.innerHTML = "";
	this.wrapperElement.appendChild(poster);

	this.thumbImage(url).then(() => {
		poster.style.opacity = '1'
	})


	return poster
}	

	transcodingMessage(){
		var message = document.createElement("div");
			message.className = 'vjs-transcoding-message'
			message.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Video is being processed</span>'

			

		this.wrapperElement.appendChild(message);
	}

  createARElement(videoInfo: VideoDetails) {

		const videoSizeValue = videoInfo.aspectRatio

		const paddingSize: Number = 100 / (2 * videoSizeValue);

		var aslayer = document.createElement("div");
		aslayer.classList.add("aspectratio-matte");
		aslayer.style.cssText = `padding-top: ${paddingSize}%; padding-bottom: ${paddingSize}%; height: 1px!important;`;

		return aslayer

	}

	setARElement(videoInfo: VideoDetails, element : any) {

		console.log('element', element)

		try {

			var aslayer = this.createARElement(videoInfo)
			this.deleteLoadingPlaceholder()

			if (element)
				element.appendChild(aslayer)


		}
		catch (e) {
			console.log("E", e)
		}

	}

	deleteLoadingPlaceholder() {

		try {
			var el = this.wrapperElement.getElementsByClassName('jsPlayerLoading')[0]

			if (el)
				this.wrapperElement.removeChild(el);

			var el2 = this.wrapperElement.getElementsByClassName('vjs-thumb')[0]

			if (el2)
				this.wrapperElement.removeChild(el2);

			this.wrapperElement.classList.add('player-ready')

		}
		catch (e) {
			console.error(e)
		}

	}

  private getPlaceholderElement () {
    return document.getElementById('placeholder-preview')
  }

  private removeElement (element: HTMLElement) {
    element.parentElement.removeChild(element)
  }
}
