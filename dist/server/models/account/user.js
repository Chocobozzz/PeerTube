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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
var UserModel_1;
const Sequelize = require("sequelize");
const sequelize_typescript_1 = require("sequelize-typescript");
const shared_1 = require("../../../shared");
const users_1 = require("../../helpers/custom-validators/users");
const peertube_crypto_1 = require("../../helpers/peertube-crypto");
const oauth_token_1 = require("../oauth/oauth-token");
const utils_1 = require("../utils");
const video_channel_1 = require("../video/video-channel");
const account_1 = require("./account");
const lodash_1 = require("lodash");
const initializers_1 = require("../../initializers");
const oauth_model_1 = require("../../lib/oauth-model");
var ScopeNames;
(function (ScopeNames) {
    ScopeNames["WITH_VIDEO_CHANNEL"] = "WITH_VIDEO_CHANNEL";
})(ScopeNames || (ScopeNames = {}));
let UserModel = UserModel_1 = class UserModel extends sequelize_typescript_1.Model {
    static cryptPasswordIfNeeded(instance) {
        if (instance.changed('password')) {
            return peertube_crypto_1.cryptPassword(instance.password)
                .then(hash => {
                instance.password = hash;
                return undefined;
            });
        }
    }
    static removeTokenCache(instance) {
        return oauth_model_1.clearCacheByUserId(instance.id);
    }
    static countTotal() {
        return this.count();
    }
    static listForApi(start, count, sort, search) {
        let where = undefined;
        if (search) {
            where = {
                [Sequelize.Op.or]: [
                    {
                        email: {
                            [Sequelize.Op.iLike]: '%' + search + '%'
                        }
                    },
                    {
                        username: {
                            [Sequelize.Op.iLike]: '%' + search + '%'
                        }
                    }
                ]
            };
        }
        const query = {
            attributes: {
                include: [
                    [
                        Sequelize.literal('(' +
                            'SELECT COALESCE(SUM("size"), 0) ' +
                            'FROM (' +
                            'SELECT MAX("videoFile"."size") AS "size" FROM "videoFile" ' +
                            'INNER JOIN "video" ON "videoFile"."videoId" = "video"."id" ' +
                            'INNER JOIN "videoChannel" ON "videoChannel"."id" = "video"."channelId" ' +
                            'INNER JOIN "account" ON "videoChannel"."accountId" = "account"."id" ' +
                            'WHERE "account"."userId" = "UserModel"."id" GROUP BY "video"."id"' +
                            ') t' +
                            ')'),
                        'videoQuotaUsed'
                    ]
                ]
            },
            offset: start,
            limit: count,
            order: utils_1.getSort(sort),
            where
        };
        return UserModel_1.findAndCountAll(query)
            .then(({ rows, count }) => {
            return {
                data: rows,
                total: count
            };
        });
    }
    static listEmailsWithRight(right) {
        const roles = Object.keys(shared_1.USER_ROLE_LABELS)
            .map(k => parseInt(k, 10))
            .filter(role => shared_1.hasUserRight(role, right));
        const query = {
            attribute: ['email'],
            where: {
                role: {
                    [Sequelize.Op.in]: roles
                }
            }
        };
        return UserModel_1.unscoped()
            .findAll(query)
            .then(u => u.map(u => u.email));
    }
    static loadById(id) {
        return UserModel_1.findById(id);
    }
    static loadByUsername(username) {
        const query = {
            where: {
                username
            }
        };
        return UserModel_1.findOne(query);
    }
    static loadByUsernameAndPopulateChannels(username) {
        const query = {
            where: {
                username
            }
        };
        return UserModel_1.scope(ScopeNames.WITH_VIDEO_CHANNEL).findOne(query);
    }
    static loadByEmail(email) {
        const query = {
            where: {
                email
            }
        };
        return UserModel_1.findOne(query);
    }
    static loadByUsernameOrEmail(username, email) {
        if (!email)
            email = username;
        const query = {
            where: {
                [Sequelize.Op.or]: [{ username }, { email }]
            }
        };
        return UserModel_1.findOne(query);
    }
    static getOriginalVideoFileTotalFromUser(user) {
        const query = UserModel_1.generateUserQuotaBaseSQL();
        return UserModel_1.getTotalRawQuery(query, user.id);
    }
    static getOriginalVideoFileTotalDailyFromUser(user) {
        const query = UserModel_1.generateUserQuotaBaseSQL('"video"."createdAt" > now() - interval \'24 hours\'');
        return UserModel_1.getTotalRawQuery(query, user.id);
    }
    static getStats() {
        return __awaiter(this, void 0, void 0, function* () {
            const totalUsers = yield UserModel_1.count();
            return {
                totalUsers
            };
        });
    }
    static autoComplete(search) {
        const query = {
            where: {
                username: {
                    [Sequelize.Op.like]: `%${search}%`
                }
            },
            limit: 10
        };
        return UserModel_1.findAll(query)
            .then(u => u.map(u => u.username));
    }
    hasRight(right) {
        return shared_1.hasUserRight(this.role, right);
    }
    isPasswordMatch(password) {
        return peertube_crypto_1.comparePassword(password, this.password);
    }
    toFormattedJSON() {
        const videoQuotaUsed = this.get('videoQuotaUsed');
        const videoQuotaUsedDaily = this.get('videoQuotaUsedDaily');
        const json = {
            id: this.id,
            username: this.username,
            email: this.email,
            emailVerified: this.emailVerified,
            nsfwPolicy: this.nsfwPolicy,
            webTorrentEnabled: this.webTorrentEnabled,
            autoPlayVideo: this.autoPlayVideo,
            role: this.role,
            roleLabel: shared_1.USER_ROLE_LABELS[this.role],
            videoQuota: this.videoQuota,
            videoQuotaDaily: this.videoQuotaDaily,
            createdAt: this.createdAt,
            blocked: this.blocked,
            blockedReason: this.blockedReason,
            account: this.Account.toFormattedJSON(),
            videoChannels: [],
            videoQuotaUsed: videoQuotaUsed !== undefined
                ? parseInt(videoQuotaUsed, 10)
                : undefined,
            videoQuotaUsedDaily: videoQuotaUsedDaily !== undefined
                ? parseInt(videoQuotaUsedDaily, 10)
                : undefined
        };
        if (Array.isArray(this.Account.VideoChannels) === true) {
            json.videoChannels = this.Account.VideoChannels
                .map(c => c.toFormattedJSON())
                .sort((v1, v2) => {
                if (v1.createdAt < v2.createdAt)
                    return -1;
                if (v1.createdAt === v2.createdAt)
                    return 0;
                return 1;
            });
        }
        return json;
    }
    isAbleToUploadVideo(videoFile) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.videoQuota === -1 && this.videoQuotaDaily === -1)
                return Promise.resolve(true);
            const [totalBytes, totalBytesDaily] = yield Promise.all([
                UserModel_1.getOriginalVideoFileTotalFromUser(this),
                UserModel_1.getOriginalVideoFileTotalDailyFromUser(this)
            ]);
            const uploadedTotal = videoFile.size + totalBytes;
            const uploadedDaily = videoFile.size + totalBytesDaily;
            if (this.videoQuotaDaily === -1) {
                return uploadedTotal < this.videoQuota;
            }
            if (this.videoQuota === -1) {
                return uploadedDaily < this.videoQuotaDaily;
            }
            return (uploadedTotal < this.videoQuota) &&
                (uploadedDaily < this.videoQuotaDaily);
        });
    }
    static generateUserQuotaBaseSQL(where) {
        const andWhere = where ? 'AND ' + where : '';
        return 'SELECT SUM("size") AS "total" ' +
            'FROM (' +
            'SELECT MAX("videoFile"."size") AS "size" FROM "videoFile" ' +
            'INNER JOIN "video" ON "videoFile"."videoId" = "video"."id" ' +
            'INNER JOIN "videoChannel" ON "videoChannel"."id" = "video"."channelId" ' +
            'INNER JOIN "account" ON "videoChannel"."accountId" = "account"."id" ' +
            'WHERE "account"."userId" = $userId ' + andWhere +
            'GROUP BY "video"."id"' +
            ') t';
    }
    static getTotalRawQuery(query, userId) {
        const options = {
            bind: { userId },
            type: Sequelize.QueryTypes.SELECT
        };
        return UserModel_1.sequelize.query(query, options)
            .then(([{ total }]) => {
            if (total === null)
                return 0;
            return parseInt(total, 10);
        });
    }
};
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Is('UserPassword', value => utils_1.throwIfNotValid(value, users_1.isUserPasswordValid, 'user password')),
    sequelize_typescript_1.Column,
    __metadata("design:type", String)
], UserModel.prototype, "password", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Is('UserPassword', value => utils_1.throwIfNotValid(value, users_1.isUserUsernameValid, 'user name')),
    sequelize_typescript_1.Column,
    __metadata("design:type", String)
], UserModel.prototype, "username", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.IsEmail,
    sequelize_typescript_1.Column(sequelize_typescript_1.DataType.STRING(400)),
    __metadata("design:type", String)
], UserModel.prototype, "email", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(true),
    sequelize_typescript_1.Default(null),
    sequelize_typescript_1.Is('UserEmailVerified', value => utils_1.throwIfNotValid(value, users_1.isUserEmailVerifiedValid, 'email verified boolean')),
    sequelize_typescript_1.Column,
    __metadata("design:type", Boolean)
], UserModel.prototype, "emailVerified", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Is('UserNSFWPolicy', value => utils_1.throwIfNotValid(value, users_1.isUserNSFWPolicyValid, 'NSFW policy')),
    sequelize_typescript_1.Column(sequelize_typescript_1.DataType.ENUM(lodash_1.values(initializers_1.NSFW_POLICY_TYPES))),
    __metadata("design:type", String)
], UserModel.prototype, "nsfwPolicy", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Default(true),
    sequelize_typescript_1.Is('UserWebTorrentEnabled', value => utils_1.throwIfNotValid(value, users_1.isUserWebTorrentEnabledValid, 'WebTorrent enabled')),
    sequelize_typescript_1.Column,
    __metadata("design:type", Boolean)
], UserModel.prototype, "webTorrentEnabled", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Default(true),
    sequelize_typescript_1.Is('UserAutoPlayVideo', value => utils_1.throwIfNotValid(value, users_1.isUserAutoPlayVideoValid, 'auto play video boolean')),
    sequelize_typescript_1.Column,
    __metadata("design:type", Boolean)
], UserModel.prototype, "autoPlayVideo", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Default(false),
    sequelize_typescript_1.Is('UserBlocked', value => utils_1.throwIfNotValid(value, users_1.isUserBlockedValid, 'blocked boolean')),
    sequelize_typescript_1.Column,
    __metadata("design:type", Boolean)
], UserModel.prototype, "blocked", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(true),
    sequelize_typescript_1.Default(null),
    sequelize_typescript_1.Is('UserBlockedReason', value => utils_1.throwIfNotValid(value, users_1.isUserBlockedReasonValid, 'blocked reason')),
    sequelize_typescript_1.Column,
    __metadata("design:type", String)
], UserModel.prototype, "blockedReason", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Is('UserRole', value => utils_1.throwIfNotValid(value, users_1.isUserRoleValid, 'role')),
    sequelize_typescript_1.Column,
    __metadata("design:type", Number)
], UserModel.prototype, "role", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Is('UserVideoQuota', value => utils_1.throwIfNotValid(value, users_1.isUserVideoQuotaValid, 'video quota')),
    sequelize_typescript_1.Column(sequelize_typescript_1.DataType.BIGINT),
    __metadata("design:type", Number)
], UserModel.prototype, "videoQuota", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Is('UserVideoQuotaDaily', value => utils_1.throwIfNotValid(value, users_1.isUserVideoQuotaDailyValid, 'video quota daily')),
    sequelize_typescript_1.Column(sequelize_typescript_1.DataType.BIGINT),
    __metadata("design:type", Number)
], UserModel.prototype, "videoQuotaDaily", void 0);
__decorate([
    sequelize_typescript_1.CreatedAt,
    __metadata("design:type", Date)
], UserModel.prototype, "createdAt", void 0);
__decorate([
    sequelize_typescript_1.UpdatedAt,
    __metadata("design:type", Date)
], UserModel.prototype, "updatedAt", void 0);
__decorate([
    sequelize_typescript_1.HasOne(() => account_1.AccountModel, {
        foreignKey: 'userId',
        onDelete: 'cascade',
        hooks: true
    }),
    __metadata("design:type", account_1.AccountModel)
], UserModel.prototype, "Account", void 0);
__decorate([
    sequelize_typescript_1.HasMany(() => oauth_token_1.OAuthTokenModel, {
        foreignKey: 'userId',
        onDelete: 'cascade'
    }),
    __metadata("design:type", Array)
], UserModel.prototype, "OAuthTokens", void 0);
__decorate([
    sequelize_typescript_1.BeforeCreate,
    sequelize_typescript_1.BeforeUpdate,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [UserModel]),
    __metadata("design:returntype", void 0)
], UserModel, "cryptPasswordIfNeeded", null);
__decorate([
    sequelize_typescript_1.AfterUpdate,
    sequelize_typescript_1.AfterDelete,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [UserModel]),
    __metadata("design:returntype", void 0)
], UserModel, "removeTokenCache", null);
UserModel = UserModel_1 = __decorate([
    sequelize_typescript_1.DefaultScope({
        include: [
            {
                model: () => account_1.AccountModel,
                required: true
            }
        ]
    }),
    sequelize_typescript_1.Scopes({
        [ScopeNames.WITH_VIDEO_CHANNEL]: {
            include: [
                {
                    model: () => account_1.AccountModel,
                    required: true,
                    include: [() => video_channel_1.VideoChannelModel]
                }
            ]
        }
    }),
    sequelize_typescript_1.Table({
        tableName: 'user',
        indexes: [
            {
                fields: ['username'],
                unique: true
            },
            {
                fields: ['email'],
                unique: true
            }
        ]
    })
], UserModel);
exports.UserModel = UserModel;
