"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const i18n_1 = require("../../shared/models/i18n/i18n");
const initializers_1 = require("../initializers");
const path_1 = require("path");
const core_utils_1 = require("../helpers/core-utils");
const video_1 = require("../models/video/video");
const validator = require("validator");
const videos_1 = require("../../shared/models/videos");
const fs_extra_1 = require("fs-extra");
const video_format_utils_1 = require("../models/video/video-format-utils");
class ClientHtml {
    static invalidCache() {
        ClientHtml.htmlCache = {};
    }
    static getIndexHTML(req, res, paramLang) {
        return __awaiter(this, void 0, void 0, function* () {
            const path = ClientHtml.getIndexPath(req, res, paramLang);
            if (ClientHtml.htmlCache[path])
                return ClientHtml.htmlCache[path];
            const buffer = yield fs_extra_1.readFile(path);
            let html = buffer.toString();
            html = ClientHtml.addTitleTag(html);
            html = ClientHtml.addDescriptionTag(html);
            html = ClientHtml.addCustomCSS(html);
            ClientHtml.htmlCache[path] = html;
            return html;
        });
    }
    static getWatchHTMLPage(videoId, req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            let videoPromise;
            if (validator.isInt(videoId) || validator.isUUID(videoId, 4)) {
                videoPromise = video_1.VideoModel.loadAndPopulateAccountAndServerAndTags(videoId);
            }
            else {
                return ClientHtml.getIndexHTML(req, res);
            }
            const [html, video] = yield Promise.all([
                ClientHtml.getIndexHTML(req, res),
                videoPromise
            ]);
            if (!video || video.privacy === videos_1.VideoPrivacy.PRIVATE) {
                return ClientHtml.getIndexHTML(req, res);
            }
            return ClientHtml.addOpenGraphAndOEmbedTags(html, video);
        });
    }
    static getIndexPath(req, res, paramLang) {
        let lang;
        if (paramLang && i18n_1.is18nLocale(paramLang)) {
            lang = paramLang;
            res.cookie('clientLanguage', lang, {
                secure: initializers_1.CONFIG.WEBSERVER.SCHEME === 'https',
                sameSite: true,
                maxAge: 1000 * 3600 * 24 * 90
            });
        }
        else if (req.cookies.clientLanguage && i18n_1.is18nLocale(req.cookies.clientLanguage)) {
            lang = req.cookies.clientLanguage;
        }
        else {
            lang = req.acceptsLanguages(i18n_1.POSSIBLE_LOCALES) || i18n_1.getDefaultLocale();
        }
        return path_1.join(__dirname, '../../../client/dist/' + i18n_1.buildFileLocale(lang) + '/index.html');
    }
    static addTitleTag(htmlStringPage) {
        const titleTag = '<title>' + initializers_1.CONFIG.INSTANCE.NAME + '</title>';
        return htmlStringPage.replace(initializers_1.CUSTOM_HTML_TAG_COMMENTS.TITLE, titleTag);
    }
    static addDescriptionTag(htmlStringPage) {
        const descriptionTag = `<meta name="description" content="${initializers_1.CONFIG.INSTANCE.SHORT_DESCRIPTION}" />`;
        return htmlStringPage.replace(initializers_1.CUSTOM_HTML_TAG_COMMENTS.DESCRIPTION, descriptionTag);
    }
    static addCustomCSS(htmlStringPage) {
        const styleTag = '<style class="custom-css-style">' + initializers_1.CONFIG.INSTANCE.CUSTOMIZATIONS.CSS + '</style>';
        return htmlStringPage.replace(initializers_1.CUSTOM_HTML_TAG_COMMENTS.CUSTOM_CSS, styleTag);
    }
    static addOpenGraphAndOEmbedTags(htmlStringPage, video) {
        const previewUrl = initializers_1.CONFIG.WEBSERVER.URL + initializers_1.STATIC_PATHS.PREVIEWS + video.getPreviewName();
        const videoUrl = initializers_1.CONFIG.WEBSERVER.URL + '/videos/watch/' + video.uuid;
        const videoNameEscaped = core_utils_1.escapeHTML(video.name);
        const videoDescriptionEscaped = core_utils_1.escapeHTML(video.description);
        const embedUrl = initializers_1.CONFIG.WEBSERVER.URL + video.getEmbedStaticPath();
        const openGraphMetaTags = {
            'og:type': 'video',
            'og:title': videoNameEscaped,
            'og:image': previewUrl,
            'og:url': videoUrl,
            'og:description': videoDescriptionEscaped,
            'og:video:url': embedUrl,
            'og:video:secure_url': embedUrl,
            'og:video:type': 'text/html',
            'og:video:width': initializers_1.EMBED_SIZE.width,
            'og:video:height': initializers_1.EMBED_SIZE.height,
            'name': videoNameEscaped,
            'description': videoDescriptionEscaped,
            'image': previewUrl,
            'twitter:card': initializers_1.CONFIG.SERVICES.TWITTER.WHITELISTED ? 'player' : 'summary_large_image',
            'twitter:site': initializers_1.CONFIG.SERVICES.TWITTER.USERNAME,
            'twitter:title': videoNameEscaped,
            'twitter:description': videoDescriptionEscaped,
            'twitter:image': previewUrl,
            'twitter:player': embedUrl,
            'twitter:player:width': initializers_1.EMBED_SIZE.width,
            'twitter:player:height': initializers_1.EMBED_SIZE.height
        };
        const oembedLinkTags = [
            {
                type: 'application/json+oembed',
                href: initializers_1.CONFIG.WEBSERVER.URL + '/services/oembed?url=' + encodeURIComponent(videoUrl),
                title: videoNameEscaped
            }
        ];
        const schemaTags = {
            '@context': 'http://schema.org',
            '@type': 'VideoObject',
            name: videoNameEscaped,
            description: videoDescriptionEscaped,
            thumbnailUrl: previewUrl,
            uploadDate: video.createdAt.toISOString(),
            duration: video_format_utils_1.getActivityStreamDuration(video.duration),
            contentUrl: videoUrl,
            embedUrl: embedUrl,
            interactionCount: video.views
        };
        let tagsString = '';
        Object.keys(openGraphMetaTags).forEach(tagName => {
            const tagValue = openGraphMetaTags[tagName];
            tagsString += `<meta property="${tagName}" content="${tagValue}" />`;
        });
        for (const oembedLinkTag of oembedLinkTags) {
            tagsString += `<link rel="alternate" type="${oembedLinkTag.type}" href="${oembedLinkTag.href}" title="${oembedLinkTag.title}" />`;
        }
        tagsString += `<script type="application/ld+json">${JSON.stringify(schemaTags)}</script>`;
        tagsString += `<link rel="canonical" href="${videoUrl}" />`;
        return htmlStringPage.replace(initializers_1.CUSTOM_HTML_TAG_COMMENTS.OPENGRAPH_AND_OEMBED, tagsString);
    }
}
ClientHtml.htmlCache = {};
exports.ClientHtml = ClientHtml;
//# sourceMappingURL=client-html.js.map