"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
var ActorModel_1;
const lodash_1 = require("lodash");
const path_1 = require("path");
const Sequelize = require("sequelize");
const sequelize_typescript_1 = require("sequelize-typescript");
const activitypub_1 = require("../../helpers/activitypub");
const actor_1 = require("../../helpers/custom-validators/activitypub/actor");
const misc_1 = require("../../helpers/custom-validators/activitypub/misc");
const initializers_1 = require("../../initializers");
const account_1 = require("../account/account");
const avatar_1 = require("../avatar/avatar");
const server_1 = require("../server/server");
const utils_1 = require("../utils");
const video_channel_1 = require("../video/video-channel");
const actor_follow_1 = require("./actor-follow");
const video_1 = require("../video/video");
var ScopeNames;
(function (ScopeNames) {
    ScopeNames["FULL"] = "FULL";
})(ScopeNames || (ScopeNames = {}));
exports.unusedActorAttributesForAPI = [
    'publicKey',
    'privateKey',
    'inboxUrl',
    'outboxUrl',
    'sharedInboxUrl',
    'followersUrl',
    'followingUrl',
    'url',
    'createdAt',
    'updatedAt'
];
let ActorModel = ActorModel_1 = class ActorModel extends sequelize_typescript_1.Model {
    static load(id) {
        return ActorModel_1.unscoped().findById(id);
    }
    static loadAccountActorByVideoId(videoId, transaction) {
        const query = {
            include: [
                {
                    attributes: ['id'],
                    model: account_1.AccountModel.unscoped(),
                    required: true,
                    include: [
                        {
                            attributes: ['id'],
                            model: video_channel_1.VideoChannelModel.unscoped(),
                            required: true,
                            include: {
                                attributes: ['id'],
                                model: video_1.VideoModel.unscoped(),
                                required: true,
                                where: {
                                    id: videoId
                                }
                            }
                        }
                    ]
                }
            ],
            transaction
        };
        return ActorModel_1.unscoped().findOne(query);
    }
    static isActorUrlExist(url) {
        const query = {
            raw: true,
            where: {
                url
            }
        };
        return ActorModel_1.unscoped().findOne(query)
            .then(a => !!a);
    }
    static listByFollowersUrls(followersUrls, transaction) {
        const query = {
            where: {
                followersUrl: {
                    [Sequelize.Op.in]: followersUrls
                }
            },
            transaction
        };
        return ActorModel_1.scope(ScopeNames.FULL).findAll(query);
    }
    static loadLocalByName(preferredUsername, transaction) {
        const query = {
            where: {
                preferredUsername,
                serverId: null
            },
            transaction
        };
        return ActorModel_1.scope(ScopeNames.FULL).findOne(query);
    }
    static loadByNameAndHost(preferredUsername, host) {
        const query = {
            where: {
                preferredUsername
            },
            include: [
                {
                    model: server_1.ServerModel,
                    required: true,
                    where: {
                        host
                    }
                }
            ]
        };
        return ActorModel_1.scope(ScopeNames.FULL).findOne(query);
    }
    static loadByUrl(url, transaction) {
        const query = {
            where: {
                url
            },
            transaction,
            include: [
                {
                    attributes: ['id'],
                    model: account_1.AccountModel.unscoped(),
                    required: false
                },
                {
                    attributes: ['id'],
                    model: video_channel_1.VideoChannelModel.unscoped(),
                    required: false
                }
            ]
        };
        return ActorModel_1.unscoped().findOne(query);
    }
    static loadByUrlAndPopulateAccountAndChannel(url, transaction) {
        const query = {
            where: {
                url
            },
            transaction
        };
        return ActorModel_1.scope(ScopeNames.FULL).findOne(query);
    }
    static incrementFollows(id, column, by) {
        return ActorModel_1.increment(column, {
            by,
            where: {
                id
            }
        });
    }
    toFormattedJSON() {
        let avatar = null;
        if (this.Avatar) {
            avatar = this.Avatar.toFormattedJSON();
        }
        return {
            id: this.id,
            url: this.url,
            uuid: this.uuid,
            name: this.preferredUsername,
            host: this.getHost(),
            hostRedundancyAllowed: this.getRedundancyAllowed(),
            followingCount: this.followingCount,
            followersCount: this.followersCount,
            avatar,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }
    toActivityPubObject(name, type) {
        let activityPubType;
        if (type === 'Account') {
            activityPubType = 'Person';
        }
        else if (type === 'Application') {
            activityPubType = 'Application';
        }
        else {
            activityPubType = 'Group';
        }
        let icon = undefined;
        if (this.avatarId) {
            const extension = path_1.extname(this.Avatar.filename);
            icon = {
                type: 'Image',
                mediaType: extension === '.png' ? 'image/png' : 'image/jpeg',
                url: this.getAvatarUrl()
            };
        }
        const json = {
            type: activityPubType,
            id: this.url,
            following: this.getFollowingUrl(),
            followers: this.getFollowersUrl(),
            inbox: this.inboxUrl,
            outbox: this.outboxUrl,
            preferredUsername: this.preferredUsername,
            url: this.url,
            name,
            endpoints: {
                sharedInbox: this.sharedInboxUrl
            },
            uuid: this.uuid,
            publicKey: {
                id: this.getPublicKeyUrl(),
                owner: this.url,
                publicKeyPem: this.publicKey
            },
            icon
        };
        return activitypub_1.activityPubContextify(json);
    }
    getFollowerSharedInboxUrls(t) {
        const query = {
            attributes: ['sharedInboxUrl'],
            include: [
                {
                    attribute: [],
                    model: actor_follow_1.ActorFollowModel.unscoped(),
                    required: true,
                    as: 'ActorFollowing',
                    where: {
                        state: 'accepted',
                        targetActorId: this.id
                    }
                }
            ],
            transaction: t
        };
        return ActorModel_1.findAll(query)
            .then(accounts => accounts.map(a => a.sharedInboxUrl));
    }
    getFollowingUrl() {
        return this.url + '/following';
    }
    getFollowersUrl() {
        return this.url + '/followers';
    }
    getPublicKeyUrl() {
        return this.url + '#main-key';
    }
    isOwned() {
        return this.serverId === null;
    }
    getWebfingerUrl() {
        return 'acct:' + this.preferredUsername + '@' + this.getHost();
    }
    getIdentifier() {
        return this.Server ? `${this.preferredUsername}@${this.Server.host}` : this.preferredUsername;
    }
    getHost() {
        return this.Server ? this.Server.host : initializers_1.CONFIG.WEBSERVER.HOST;
    }
    getRedundancyAllowed() {
        return this.Server ? this.Server.redundancyAllowed : false;
    }
    getAvatarUrl() {
        if (!this.avatarId)
            return undefined;
        return initializers_1.CONFIG.WEBSERVER.URL + this.Avatar.getWebserverPath();
    }
    isOutdated() {
        if (this.isOwned())
            return false;
        const now = Date.now();
        const createdAtTime = this.createdAt.getTime();
        const updatedAtTime = this.updatedAt.getTime();
        return (now - createdAtTime) > initializers_1.ACTIVITY_PUB.ACTOR_REFRESH_INTERVAL &&
            (now - updatedAtTime) > initializers_1.ACTIVITY_PUB.ACTOR_REFRESH_INTERVAL;
    }
};
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Column(sequelize_typescript_1.DataType.ENUM(lodash_1.values(initializers_1.ACTIVITY_PUB_ACTOR_TYPES))),
    __metadata("design:type", String)
], ActorModel.prototype, "type", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Default(sequelize_typescript_1.DataType.UUIDV4),
    sequelize_typescript_1.IsUUID(4),
    sequelize_typescript_1.Column(sequelize_typescript_1.DataType.UUID),
    __metadata("design:type", String)
], ActorModel.prototype, "uuid", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Is('ActorPreferredUsername', value => utils_1.throwIfNotValid(value, actor_1.isActorPreferredUsernameValid, 'actor preferred username')),
    sequelize_typescript_1.Column,
    __metadata("design:type", String)
], ActorModel.prototype, "preferredUsername", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Is('ActorUrl', value => utils_1.throwIfNotValid(value, misc_1.isActivityPubUrlValid, 'url')),
    sequelize_typescript_1.Column(sequelize_typescript_1.DataType.STRING(initializers_1.CONSTRAINTS_FIELDS.ACTORS.URL.max)),
    __metadata("design:type", String)
], ActorModel.prototype, "url", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(true),
    sequelize_typescript_1.Is('ActorPublicKey', value => utils_1.throwIfNotValid(value, actor_1.isActorPublicKeyValid, 'public key')),
    sequelize_typescript_1.Column(sequelize_typescript_1.DataType.STRING(initializers_1.CONSTRAINTS_FIELDS.ACTORS.PUBLIC_KEY.max)),
    __metadata("design:type", String)
], ActorModel.prototype, "publicKey", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(true),
    sequelize_typescript_1.Is('ActorPublicKey', value => utils_1.throwIfNotValid(value, actor_1.isActorPrivateKeyValid, 'private key')),
    sequelize_typescript_1.Column(sequelize_typescript_1.DataType.STRING(initializers_1.CONSTRAINTS_FIELDS.ACTORS.PRIVATE_KEY.max)),
    __metadata("design:type", String)
], ActorModel.prototype, "privateKey", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Is('ActorFollowersCount', value => utils_1.throwIfNotValid(value, actor_1.isActorFollowersCountValid, 'followers count')),
    sequelize_typescript_1.Column,
    __metadata("design:type", Number)
], ActorModel.prototype, "followersCount", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Is('ActorFollowersCount', value => utils_1.throwIfNotValid(value, actor_1.isActorFollowingCountValid, 'following count')),
    sequelize_typescript_1.Column,
    __metadata("design:type", Number)
], ActorModel.prototype, "followingCount", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Is('ActorInboxUrl', value => utils_1.throwIfNotValid(value, misc_1.isActivityPubUrlValid, 'inbox url')),
    sequelize_typescript_1.Column(sequelize_typescript_1.DataType.STRING(initializers_1.CONSTRAINTS_FIELDS.ACTORS.URL.max)),
    __metadata("design:type", String)
], ActorModel.prototype, "inboxUrl", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Is('ActorOutboxUrl', value => utils_1.throwIfNotValid(value, misc_1.isActivityPubUrlValid, 'outbox url')),
    sequelize_typescript_1.Column(sequelize_typescript_1.DataType.STRING(initializers_1.CONSTRAINTS_FIELDS.ACTORS.URL.max)),
    __metadata("design:type", String)
], ActorModel.prototype, "outboxUrl", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Is('ActorSharedInboxUrl', value => utils_1.throwIfNotValid(value, misc_1.isActivityPubUrlValid, 'shared inbox url')),
    sequelize_typescript_1.Column(sequelize_typescript_1.DataType.STRING(initializers_1.CONSTRAINTS_FIELDS.ACTORS.URL.max)),
    __metadata("design:type", String)
], ActorModel.prototype, "sharedInboxUrl", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Is('ActorFollowersUrl', value => utils_1.throwIfNotValid(value, misc_1.isActivityPubUrlValid, 'followers url')),
    sequelize_typescript_1.Column(sequelize_typescript_1.DataType.STRING(initializers_1.CONSTRAINTS_FIELDS.ACTORS.URL.max)),
    __metadata("design:type", String)
], ActorModel.prototype, "followersUrl", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Is('ActorFollowingUrl', value => utils_1.throwIfNotValid(value, misc_1.isActivityPubUrlValid, 'following url')),
    sequelize_typescript_1.Column(sequelize_typescript_1.DataType.STRING(initializers_1.CONSTRAINTS_FIELDS.ACTORS.URL.max)),
    __metadata("design:type", String)
], ActorModel.prototype, "followingUrl", void 0);
__decorate([
    sequelize_typescript_1.CreatedAt,
    __metadata("design:type", Date)
], ActorModel.prototype, "createdAt", void 0);
__decorate([
    sequelize_typescript_1.UpdatedAt,
    __metadata("design:type", Date)
], ActorModel.prototype, "updatedAt", void 0);
__decorate([
    sequelize_typescript_1.ForeignKey(() => avatar_1.AvatarModel),
    sequelize_typescript_1.Column,
    __metadata("design:type", Number)
], ActorModel.prototype, "avatarId", void 0);
__decorate([
    sequelize_typescript_1.BelongsTo(() => avatar_1.AvatarModel, {
        foreignKey: {
            allowNull: true
        },
        onDelete: 'set null',
        hooks: true
    }),
    __metadata("design:type", avatar_1.AvatarModel)
], ActorModel.prototype, "Avatar", void 0);
__decorate([
    sequelize_typescript_1.HasMany(() => actor_follow_1.ActorFollowModel, {
        foreignKey: {
            name: 'actorId',
            allowNull: false
        },
        onDelete: 'cascade'
    }),
    __metadata("design:type", Array)
], ActorModel.prototype, "ActorFollowing", void 0);
__decorate([
    sequelize_typescript_1.HasMany(() => actor_follow_1.ActorFollowModel, {
        foreignKey: {
            name: 'targetActorId',
            allowNull: false
        },
        as: 'ActorFollowers',
        onDelete: 'cascade'
    }),
    __metadata("design:type", Array)
], ActorModel.prototype, "ActorFollowers", void 0);
__decorate([
    sequelize_typescript_1.ForeignKey(() => server_1.ServerModel),
    sequelize_typescript_1.Column,
    __metadata("design:type", Number)
], ActorModel.prototype, "serverId", void 0);
__decorate([
    sequelize_typescript_1.BelongsTo(() => server_1.ServerModel, {
        foreignKey: {
            allowNull: true
        },
        onDelete: 'cascade'
    }),
    __metadata("design:type", server_1.ServerModel)
], ActorModel.prototype, "Server", void 0);
__decorate([
    sequelize_typescript_1.HasOne(() => account_1.AccountModel, {
        foreignKey: {
            allowNull: true
        },
        onDelete: 'cascade',
        hooks: true
    }),
    __metadata("design:type", account_1.AccountModel)
], ActorModel.prototype, "Account", void 0);
__decorate([
    sequelize_typescript_1.HasOne(() => video_channel_1.VideoChannelModel, {
        foreignKey: {
            allowNull: true
        },
        onDelete: 'cascade',
        hooks: true
    }),
    __metadata("design:type", video_channel_1.VideoChannelModel)
], ActorModel.prototype, "VideoChannel", void 0);
ActorModel = ActorModel_1 = __decorate([
    sequelize_typescript_1.DefaultScope({
        include: [
            {
                model: () => server_1.ServerModel,
                required: false
            },
            {
                model: () => avatar_1.AvatarModel,
                required: false
            }
        ]
    }),
    sequelize_typescript_1.Scopes({
        [ScopeNames.FULL]: {
            include: [
                {
                    model: () => account_1.AccountModel.unscoped(),
                    required: false
                },
                {
                    model: () => video_channel_1.VideoChannelModel.unscoped(),
                    required: false,
                    include: [
                        {
                            model: () => account_1.AccountModel,
                            required: true
                        }
                    ]
                },
                {
                    model: () => server_1.ServerModel,
                    required: false
                },
                {
                    model: () => avatar_1.AvatarModel,
                    required: false
                }
            ]
        }
    }),
    sequelize_typescript_1.Table({
        tableName: 'actor',
        indexes: [
            {
                fields: ['url'],
                unique: true
            },
            {
                fields: ['preferredUsername', 'serverId'],
                unique: true
            },
            {
                fields: ['inboxUrl', 'sharedInboxUrl']
            },
            {
                fields: ['sharedInboxUrl']
            },
            {
                fields: ['serverId']
            },
            {
                fields: ['avatarId']
            },
            {
                fields: ['uuid'],
                unique: true
            },
            {
                fields: ['followersUrl']
            }
        ]
    })
], ActorModel);
exports.ActorModel = ActorModel;
//# sourceMappingURL=actor.js.map