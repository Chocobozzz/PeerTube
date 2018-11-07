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
var VideoAbuseModel_1;
const sequelize_typescript_1 = require("sequelize-typescript");
const video_abuses_1 = require("../../helpers/custom-validators/video-abuses");
const emailer_1 = require("../../lib/emailer");
const account_1 = require("../account/account");
const utils_1 = require("../utils");
const video_1 = require("./video");
const shared_1 = require("../../../shared");
const initializers_1 = require("../../initializers");
let VideoAbuseModel = VideoAbuseModel_1 = class VideoAbuseModel extends sequelize_typescript_1.Model {
    static sendEmailNotification(instance) {
        return emailer_1.Emailer.Instance.addVideoAbuseReportJob(instance.videoId);
    }
    static loadByIdAndVideoId(id, videoId) {
        const query = {
            where: {
                id,
                videoId
            }
        };
        return VideoAbuseModel_1.findOne(query);
    }
    static listForApi(start, count, sort) {
        const query = {
            offset: start,
            limit: count,
            order: utils_1.getSort(sort),
            include: [
                {
                    model: account_1.AccountModel,
                    required: true
                },
                {
                    model: video_1.VideoModel,
                    required: true
                }
            ]
        };
        return VideoAbuseModel_1.findAndCountAll(query)
            .then(({ rows, count }) => {
            return { total: count, data: rows };
        });
    }
    toFormattedJSON() {
        return {
            id: this.id,
            reason: this.reason,
            reporterAccount: this.Account.toFormattedJSON(),
            state: {
                id: this.state,
                label: VideoAbuseModel_1.getStateLabel(this.state)
            },
            moderationComment: this.moderationComment,
            video: {
                id: this.Video.id,
                uuid: this.Video.uuid,
                name: this.Video.name
            },
            createdAt: this.createdAt
        };
    }
    toActivityPubObject() {
        return {
            type: 'Flag',
            content: this.reason,
            object: this.Video.url
        };
    }
    static getStateLabel(id) {
        return initializers_1.VIDEO_ABUSE_STATES[id] || 'Unknown';
    }
};
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Is('VideoAbuseReason', value => utils_1.throwIfNotValid(value, video_abuses_1.isVideoAbuseReasonValid, 'reason')),
    sequelize_typescript_1.Column,
    __metadata("design:type", String)
], VideoAbuseModel.prototype, "reason", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Default(null),
    sequelize_typescript_1.Is('VideoAbuseState', value => utils_1.throwIfNotValid(value, video_abuses_1.isVideoAbuseStateValid, 'state')),
    sequelize_typescript_1.Column,
    __metadata("design:type", Number)
], VideoAbuseModel.prototype, "state", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(true),
    sequelize_typescript_1.Default(null),
    sequelize_typescript_1.Is('VideoAbuseModerationComment', value => utils_1.throwIfNotValid(value, video_abuses_1.isVideoAbuseModerationCommentValid, 'moderationComment')),
    sequelize_typescript_1.Column(sequelize_typescript_1.DataType.STRING(initializers_1.CONSTRAINTS_FIELDS.VIDEO_ABUSES.MODERATION_COMMENT.max)),
    __metadata("design:type", String)
], VideoAbuseModel.prototype, "moderationComment", void 0);
__decorate([
    sequelize_typescript_1.CreatedAt,
    __metadata("design:type", Date)
], VideoAbuseModel.prototype, "createdAt", void 0);
__decorate([
    sequelize_typescript_1.UpdatedAt,
    __metadata("design:type", Date)
], VideoAbuseModel.prototype, "updatedAt", void 0);
__decorate([
    sequelize_typescript_1.ForeignKey(() => account_1.AccountModel),
    sequelize_typescript_1.Column,
    __metadata("design:type", Number)
], VideoAbuseModel.prototype, "reporterAccountId", void 0);
__decorate([
    sequelize_typescript_1.BelongsTo(() => account_1.AccountModel, {
        foreignKey: {
            allowNull: false
        },
        onDelete: 'cascade'
    }),
    __metadata("design:type", account_1.AccountModel)
], VideoAbuseModel.prototype, "Account", void 0);
__decorate([
    sequelize_typescript_1.ForeignKey(() => video_1.VideoModel),
    sequelize_typescript_1.Column,
    __metadata("design:type", Number)
], VideoAbuseModel.prototype, "videoId", void 0);
__decorate([
    sequelize_typescript_1.BelongsTo(() => video_1.VideoModel, {
        foreignKey: {
            allowNull: false
        },
        onDelete: 'cascade'
    }),
    __metadata("design:type", video_1.VideoModel)
], VideoAbuseModel.prototype, "Video", void 0);
__decorate([
    sequelize_typescript_1.AfterCreate,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [VideoAbuseModel]),
    __metadata("design:returntype", void 0)
], VideoAbuseModel, "sendEmailNotification", null);
VideoAbuseModel = VideoAbuseModel_1 = __decorate([
    sequelize_typescript_1.Table({
        tableName: 'videoAbuse',
        indexes: [
            {
                fields: ['videoId']
            },
            {
                fields: ['reporterAccountId']
            }
        ]
    })
], VideoAbuseModel);
exports.VideoAbuseModel = VideoAbuseModel;
//# sourceMappingURL=video-abuse.js.map