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
const express = require("express");
const lodash_1 = require("lodash");
const shared_1 = require("../../../shared");
const signup_1 = require("../../helpers/signup");
const initializers_1 = require("../../initializers");
const middlewares_1 = require("../../middlewares");
const config_1 = require("../../middlewares/validators/config");
const client_html_1 = require("../../lib/client-html");
const audit_logger_1 = require("../../helpers/audit-logger");
const fs_extra_1 = require("fs-extra");
const utils_1 = require("../../helpers/utils");
const packageJSON = require('../../../../package.json');
const configRouter = express.Router();
exports.configRouter = configRouter;
const auditLogger = audit_logger_1.auditLoggerFactory('config');
configRouter.get('/about', getAbout);
configRouter.get('/', middlewares_1.asyncMiddleware(getConfig));
configRouter.get('/custom', middlewares_1.authenticate, middlewares_1.ensureUserHasRight(shared_1.UserRight.MANAGE_CONFIGURATION), middlewares_1.asyncMiddleware(getCustomConfig));
configRouter.put('/custom', middlewares_1.authenticate, middlewares_1.ensureUserHasRight(shared_1.UserRight.MANAGE_CONFIGURATION), middlewares_1.asyncMiddleware(config_1.customConfigUpdateValidator), middlewares_1.asyncMiddleware(updateCustomConfig));
configRouter.delete('/custom', middlewares_1.authenticate, middlewares_1.ensureUserHasRight(shared_1.UserRight.MANAGE_CONFIGURATION), middlewares_1.asyncMiddleware(deleteCustomConfig));
let serverCommit;
function getConfig(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const allowed = yield signup_1.isSignupAllowed();
        const allowedForCurrentIP = signup_1.isSignupAllowedForCurrentIP(req.ip);
        serverCommit = (serverCommit) ? serverCommit : yield utils_1.getVersion();
        if (serverCommit === packageJSON.version)
            serverCommit = '';
        const enabledResolutions = Object.keys(initializers_1.CONFIG.TRANSCODING.RESOLUTIONS)
            .filter(key => initializers_1.CONFIG.TRANSCODING.ENABLED === initializers_1.CONFIG.TRANSCODING.RESOLUTIONS[key] === true)
            .map(r => parseInt(r, 10));
        const json = {
            instance: {
                name: initializers_1.CONFIG.INSTANCE.NAME,
                shortDescription: initializers_1.CONFIG.INSTANCE.SHORT_DESCRIPTION,
                defaultClientRoute: initializers_1.CONFIG.INSTANCE.DEFAULT_CLIENT_ROUTE,
                defaultNSFWPolicy: initializers_1.CONFIG.INSTANCE.DEFAULT_NSFW_POLICY,
                customizations: {
                    javascript: initializers_1.CONFIG.INSTANCE.CUSTOMIZATIONS.JAVASCRIPT,
                    css: initializers_1.CONFIG.INSTANCE.CUSTOMIZATIONS.CSS
                }
            },
            serverVersion: packageJSON.version,
            serverCommit,
            signup: {
                allowed,
                allowedForCurrentIP,
                requiresEmailVerification: initializers_1.CONFIG.SIGNUP.REQUIRES_EMAIL_VERIFICATION
            },
            transcoding: {
                enabledResolutions
            },
            import: {
                videos: {
                    http: {
                        enabled: initializers_1.CONFIG.IMPORT.VIDEOS.HTTP.ENABLED
                    },
                    torrent: {
                        enabled: initializers_1.CONFIG.IMPORT.VIDEOS.TORRENT.ENABLED
                    }
                }
            },
            avatar: {
                file: {
                    size: {
                        max: initializers_1.CONSTRAINTS_FIELDS.ACTORS.AVATAR.FILE_SIZE.max
                    },
                    extensions: initializers_1.CONSTRAINTS_FIELDS.ACTORS.AVATAR.EXTNAME
                }
            },
            video: {
                image: {
                    extensions: initializers_1.CONSTRAINTS_FIELDS.VIDEOS.IMAGE.EXTNAME,
                    size: {
                        max: initializers_1.CONSTRAINTS_FIELDS.VIDEOS.IMAGE.FILE_SIZE.max
                    }
                },
                file: {
                    extensions: initializers_1.CONSTRAINTS_FIELDS.VIDEOS.EXTNAME
                }
            },
            videoCaption: {
                file: {
                    size: {
                        max: initializers_1.CONSTRAINTS_FIELDS.VIDEO_CAPTIONS.CAPTION_FILE.FILE_SIZE.max
                    },
                    extensions: initializers_1.CONSTRAINTS_FIELDS.VIDEO_CAPTIONS.CAPTION_FILE.EXTNAME
                }
            },
            user: {
                videoQuota: initializers_1.CONFIG.USER.VIDEO_QUOTA,
                videoQuotaDaily: initializers_1.CONFIG.USER.VIDEO_QUOTA_DAILY
            }
        };
        return res.json(json);
    });
}
function getAbout(req, res, next) {
    const about = {
        instance: {
            name: initializers_1.CONFIG.INSTANCE.NAME,
            shortDescription: initializers_1.CONFIG.INSTANCE.SHORT_DESCRIPTION,
            description: initializers_1.CONFIG.INSTANCE.DESCRIPTION,
            terms: initializers_1.CONFIG.INSTANCE.TERMS
        }
    };
    return res.json(about).end();
}
function getCustomConfig(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const data = customConfig();
        return res.json(data).end();
    });
}
function deleteCustomConfig(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        yield fs_extra_1.remove(initializers_1.CONFIG.CUSTOM_FILE);
        auditLogger.delete(audit_logger_1.getAuditIdFromRes(res), new audit_logger_1.CustomConfigAuditView(customConfig()));
        initializers_1.reloadConfig();
        client_html_1.ClientHtml.invalidCache();
        const data = customConfig();
        return res.json(data).end();
    });
}
function updateCustomConfig(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const toUpdate = req.body;
        const oldCustomConfigAuditKeys = new audit_logger_1.CustomConfigAuditView(customConfig());
        toUpdate.cache.previews.size = parseInt('' + toUpdate.cache.previews.size, 10);
        toUpdate.cache.captions.size = parseInt('' + toUpdate.cache.captions.size, 10);
        toUpdate.signup.limit = parseInt('' + toUpdate.signup.limit, 10);
        toUpdate.user.videoQuota = parseInt('' + toUpdate.user.videoQuota, 10);
        toUpdate.user.videoQuotaDaily = parseInt('' + toUpdate.user.videoQuotaDaily, 10);
        toUpdate.transcoding.threads = parseInt('' + toUpdate.transcoding.threads, 10);
        const toUpdateJSON = lodash_1.omit(toUpdate, 'user.videoQuota', 'instance.defaultClientRoute', 'instance.shortDescription', 'cache.videoCaptions', 'signup.requiresEmailVerification');
        toUpdateJSON.user['video_quota'] = toUpdate.user.videoQuota;
        toUpdateJSON.user['video_quota_daily'] = toUpdate.user.videoQuotaDaily;
        toUpdateJSON.instance['default_client_route'] = toUpdate.instance.defaultClientRoute;
        toUpdateJSON.instance['short_description'] = toUpdate.instance.shortDescription;
        toUpdateJSON.instance['default_nsfw_policy'] = toUpdate.instance.defaultNSFWPolicy;
        toUpdateJSON.signup['requires_email_verification'] = toUpdate.signup.requiresEmailVerification;
        yield fs_extra_1.writeJSON(initializers_1.CONFIG.CUSTOM_FILE, toUpdateJSON, { spaces: 2 });
        initializers_1.reloadConfig();
        client_html_1.ClientHtml.invalidCache();
        const data = customConfig();
        auditLogger.update(audit_logger_1.getAuditIdFromRes(res), new audit_logger_1.CustomConfigAuditView(data), oldCustomConfigAuditKeys);
        return res.json(data).end();
    });
}
function customConfig() {
    return {
        instance: {
            name: initializers_1.CONFIG.INSTANCE.NAME,
            shortDescription: initializers_1.CONFIG.INSTANCE.SHORT_DESCRIPTION,
            description: initializers_1.CONFIG.INSTANCE.DESCRIPTION,
            terms: initializers_1.CONFIG.INSTANCE.TERMS,
            defaultClientRoute: initializers_1.CONFIG.INSTANCE.DEFAULT_CLIENT_ROUTE,
            defaultNSFWPolicy: initializers_1.CONFIG.INSTANCE.DEFAULT_NSFW_POLICY,
            customizations: {
                css: initializers_1.CONFIG.INSTANCE.CUSTOMIZATIONS.CSS,
                javascript: initializers_1.CONFIG.INSTANCE.CUSTOMIZATIONS.JAVASCRIPT
            }
        },
        services: {
            twitter: {
                username: initializers_1.CONFIG.SERVICES.TWITTER.USERNAME,
                whitelisted: initializers_1.CONFIG.SERVICES.TWITTER.WHITELISTED
            }
        },
        cache: {
            previews: {
                size: initializers_1.CONFIG.CACHE.PREVIEWS.SIZE
            },
            captions: {
                size: initializers_1.CONFIG.CACHE.VIDEO_CAPTIONS.SIZE
            }
        },
        signup: {
            enabled: initializers_1.CONFIG.SIGNUP.ENABLED,
            limit: initializers_1.CONFIG.SIGNUP.LIMIT,
            requiresEmailVerification: initializers_1.CONFIG.SIGNUP.REQUIRES_EMAIL_VERIFICATION
        },
        admin: {
            email: initializers_1.CONFIG.ADMIN.EMAIL
        },
        user: {
            videoQuota: initializers_1.CONFIG.USER.VIDEO_QUOTA,
            videoQuotaDaily: initializers_1.CONFIG.USER.VIDEO_QUOTA_DAILY
        },
        transcoding: {
            enabled: initializers_1.CONFIG.TRANSCODING.ENABLED,
            threads: initializers_1.CONFIG.TRANSCODING.THREADS,
            resolutions: {
                '240p': initializers_1.CONFIG.TRANSCODING.RESOLUTIONS['240p'],
                '360p': initializers_1.CONFIG.TRANSCODING.RESOLUTIONS['360p'],
                '480p': initializers_1.CONFIG.TRANSCODING.RESOLUTIONS['480p'],
                '720p': initializers_1.CONFIG.TRANSCODING.RESOLUTIONS['720p'],
                '1080p': initializers_1.CONFIG.TRANSCODING.RESOLUTIONS['1080p']
            }
        },
        import: {
            videos: {
                http: {
                    enabled: initializers_1.CONFIG.IMPORT.VIDEOS.HTTP.ENABLED
                },
                torrent: {
                    enabled: initializers_1.CONFIG.IMPORT.VIDEOS.TORRENT.ENABLED
                }
            }
        }
    };
}
