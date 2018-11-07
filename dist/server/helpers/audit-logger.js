"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const deep_object_diff_1 = require("deep-object-diff");
const lodash_1 = require("lodash");
const flatten = require("flat");
const winston = require("winston");
const initializers_1 = require("../initializers");
const logger_1 = require("./logger");
function getAuditIdFromRes(res) {
    return res.locals.oauth.token.User.username;
}
exports.getAuditIdFromRes = getAuditIdFromRes;
var AUDIT_TYPE;
(function (AUDIT_TYPE) {
    AUDIT_TYPE["CREATE"] = "create";
    AUDIT_TYPE["UPDATE"] = "update";
    AUDIT_TYPE["DELETE"] = "delete";
})(AUDIT_TYPE || (AUDIT_TYPE = {}));
const colors = winston.config.npm.colors;
colors.audit = winston.config.npm.colors.info;
winston.addColors(colors);
const auditLogger = winston.createLogger({
    levels: { audit: 0 },
    transports: [
        new winston.transports.File({
            filename: path.join(initializers_1.CONFIG.STORAGE.LOG_DIR, 'peertube-audit.log'),
            level: 'audit',
            maxsize: 5242880,
            maxFiles: 5,
            format: winston.format.combine(winston.format.timestamp(), logger_1.labelFormatter, winston.format.splat(), logger_1.jsonLoggerFormat)
        })
    ],
    exitOnError: true
});
function auditLoggerWrapper(domain, user, action, entity, oldEntity = null) {
    let entityInfos;
    if (action === AUDIT_TYPE.UPDATE && oldEntity) {
        const oldEntityKeys = oldEntity.toLogKeys();
        const diffObject = deep_object_diff_1.diff(oldEntityKeys, entity.toLogKeys());
        const diffKeys = Object.entries(diffObject).reduce((newKeys, entry) => {
            newKeys[`new-${entry[0]}`] = entry[1];
            return newKeys;
        }, {});
        entityInfos = Object.assign({}, oldEntityKeys, diffKeys);
    }
    else {
        entityInfos = Object.assign({}, entity.toLogKeys());
    }
    auditLogger.log('audit', JSON.stringify(Object.assign({ user,
        domain,
        action }, entityInfos)));
}
function auditLoggerFactory(domain) {
    return {
        create(user, entity) {
            auditLoggerWrapper(domain, user, AUDIT_TYPE.CREATE, entity);
        },
        update(user, entity, oldEntity) {
            auditLoggerWrapper(domain, user, AUDIT_TYPE.UPDATE, entity, oldEntity);
        },
        delete(user, entity) {
            auditLoggerWrapper(domain, user, AUDIT_TYPE.DELETE, entity);
        }
    };
}
exports.auditLoggerFactory = auditLoggerFactory;
class EntityAuditView {
    constructor(keysToKeep, prefix, entityInfos) {
        this.keysToKeep = keysToKeep;
        this.prefix = prefix;
        this.entityInfos = entityInfos;
    }
    toLogKeys() {
        return lodash_1.chain(flatten(this.entityInfos, { delimiter: '-', safe: true }))
            .pick(this.keysToKeep)
            .mapKeys((value, key) => `${this.prefix}-${key}`)
            .value();
    }
}
const videoKeysToKeep = [
    'tags',
    'uuid',
    'id',
    'uuid',
    'createdAt',
    'updatedAt',
    'publishedAt',
    'category',
    'licence',
    'language',
    'privacy',
    'description',
    'duration',
    'isLocal',
    'name',
    'thumbnailPath',
    'previewPath',
    'nsfw',
    'waitTranscoding',
    'account-id',
    'account-uuid',
    'account-name',
    'channel-id',
    'channel-uuid',
    'channel-name',
    'support',
    'commentsEnabled'
];
class VideoAuditView extends EntityAuditView {
    constructor(video) {
        super(videoKeysToKeep, 'video', video);
        this.video = video;
    }
}
exports.VideoAuditView = VideoAuditView;
const videoImportKeysToKeep = [
    'id',
    'targetUrl',
    'video-name'
];
class VideoImportAuditView extends EntityAuditView {
    constructor(videoImport) {
        super(videoImportKeysToKeep, 'video-import', videoImport);
        this.videoImport = videoImport;
    }
}
exports.VideoImportAuditView = VideoImportAuditView;
const commentKeysToKeep = [
    'id',
    'text',
    'threadId',
    'inReplyToCommentId',
    'videoId',
    'createdAt',
    'updatedAt',
    'totalReplies',
    'account-id',
    'account-uuid',
    'account-name'
];
class CommentAuditView extends EntityAuditView {
    constructor(comment) {
        super(commentKeysToKeep, 'comment', comment);
        this.comment = comment;
    }
}
exports.CommentAuditView = CommentAuditView;
const userKeysToKeep = [
    'id',
    'username',
    'email',
    'nsfwPolicy',
    'autoPlayVideo',
    'role',
    'videoQuota',
    'createdAt',
    'account-id',
    'account-uuid',
    'account-name',
    'account-followingCount',
    'account-followersCount',
    'account-createdAt',
    'account-updatedAt',
    'account-avatar-path',
    'account-avatar-createdAt',
    'account-avatar-updatedAt',
    'account-displayName',
    'account-description',
    'videoChannels'
];
class UserAuditView extends EntityAuditView {
    constructor(user) {
        super(userKeysToKeep, 'user', user);
        this.user = user;
    }
}
exports.UserAuditView = UserAuditView;
const channelKeysToKeep = [
    'id',
    'uuid',
    'name',
    'followingCount',
    'followersCount',
    'createdAt',
    'updatedAt',
    'avatar-path',
    'avatar-createdAt',
    'avatar-updatedAt',
    'displayName',
    'description',
    'support',
    'isLocal',
    'ownerAccount-id',
    'ownerAccount-uuid',
    'ownerAccount-name',
    'ownerAccount-displayedName'
];
class VideoChannelAuditView extends EntityAuditView {
    constructor(channel) {
        super(channelKeysToKeep, 'channel', channel);
        this.channel = channel;
    }
}
exports.VideoChannelAuditView = VideoChannelAuditView;
const videoAbuseKeysToKeep = [
    'id',
    'reason',
    'reporterAccount',
    'video-id',
    'video-name',
    'video-uuid',
    'createdAt'
];
class VideoAbuseAuditView extends EntityAuditView {
    constructor(videoAbuse) {
        super(videoAbuseKeysToKeep, 'abuse', videoAbuse);
        this.videoAbuse = videoAbuse;
    }
}
exports.VideoAbuseAuditView = VideoAbuseAuditView;
const customConfigKeysToKeep = [
    'instance-name',
    'instance-shortDescription',
    'instance-description',
    'instance-terms',
    'instance-defaultClientRoute',
    'instance-defaultNSFWPolicy',
    'instance-customizations-javascript',
    'instance-customizations-css',
    'services-twitter-username',
    'services-twitter-whitelisted',
    'cache-previews-size',
    'cache-captions-size',
    'signup-enabled',
    'signup-limit',
    'signup-requiresEmailVerification',
    'admin-email',
    'user-videoQuota',
    'transcoding-enabled',
    'transcoding-threads',
    'transcoding-resolutions'
];
class CustomConfigAuditView extends EntityAuditView {
    constructor(customConfig) {
        const infos = customConfig;
        const resolutionsDict = infos.transcoding.resolutions;
        const resolutionsArray = [];
        Object.entries(resolutionsDict).forEach(([resolution, isEnabled]) => {
            if (isEnabled)
                resolutionsArray.push(resolution);
        });
        Object.assign({}, infos, { transcoding: { resolutions: resolutionsArray } });
        super(customConfigKeysToKeep, 'config', infos);
    }
}
exports.CustomConfigAuditView = CustomConfigAuditView;
