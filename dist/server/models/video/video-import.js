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
var VideoImportModel_1;
const sequelize_typescript_1 = require("sequelize-typescript");
const initializers_1 = require("../../initializers");
const utils_1 = require("../utils");
const video_1 = require("./video");
const video_imports_1 = require("../../helpers/custom-validators/video-imports");
const shared_1 = require("../../../shared");
const videos_1 = require("../../helpers/custom-validators/videos");
const user_1 = require("../account/user");
let VideoImportModel = VideoImportModel_1 = class VideoImportModel extends sequelize_typescript_1.Model {
    static deleteVideoIfFailed(instance, options) {
        if (instance.state === shared_1.VideoImportState.FAILED) {
            return instance.Video.destroy({ transaction: options.transaction });
        }
        return undefined;
    }
    static loadAndPopulateVideo(id) {
        return VideoImportModel_1.findById(id);
    }
    static listUserVideoImportsForApi(userId, start, count, sort) {
        const query = {
            distinct: true,
            include: [
                {
                    model: user_1.UserModel.unscoped(),
                    required: true
                }
            ],
            offset: start,
            limit: count,
            order: utils_1.getSort(sort),
            where: {
                userId
            }
        };
        return VideoImportModel_1.findAndCountAll(query)
            .then(({ rows, count }) => {
            return {
                data: rows,
                total: count
            };
        });
    }
    toFormattedJSON() {
        const videoFormatOptions = {
            completeDescription: true,
            additionalAttributes: { state: true, waitTranscoding: true, scheduledUpdate: true }
        };
        const video = this.Video
            ? Object.assign(this.Video.toFormattedJSON(videoFormatOptions), { tags: this.Video.Tags.map(t => t.name) })
            : undefined;
        return {
            id: this.id,
            targetUrl: this.targetUrl,
            magnetUri: this.magnetUri,
            torrentName: this.torrentName,
            state: {
                id: this.state,
                label: VideoImportModel_1.getStateLabel(this.state)
            },
            error: this.error,
            updatedAt: this.updatedAt.toISOString(),
            createdAt: this.createdAt.toISOString(),
            video
        };
    }
    static getStateLabel(id) {
        return initializers_1.VIDEO_IMPORT_STATES[id] || 'Unknown';
    }
};
__decorate([
    sequelize_typescript_1.CreatedAt,
    __metadata("design:type", Date)
], VideoImportModel.prototype, "createdAt", void 0);
__decorate([
    sequelize_typescript_1.UpdatedAt,
    __metadata("design:type", Date)
], VideoImportModel.prototype, "updatedAt", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(true),
    sequelize_typescript_1.Default(null),
    sequelize_typescript_1.Is('VideoImportTargetUrl', value => utils_1.throwIfNotValid(value, video_imports_1.isVideoImportTargetUrlValid, 'targetUrl')),
    sequelize_typescript_1.Column(sequelize_typescript_1.DataType.STRING(initializers_1.CONSTRAINTS_FIELDS.VIDEO_IMPORTS.URL.max)),
    __metadata("design:type", String)
], VideoImportModel.prototype, "targetUrl", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(true),
    sequelize_typescript_1.Default(null),
    sequelize_typescript_1.Is('VideoImportMagnetUri', value => utils_1.throwIfNotValid(value, videos_1.isVideoMagnetUriValid, 'magnetUri')),
    sequelize_typescript_1.Column(sequelize_typescript_1.DataType.STRING(initializers_1.CONSTRAINTS_FIELDS.VIDEO_IMPORTS.URL.max)),
    __metadata("design:type", String)
], VideoImportModel.prototype, "magnetUri", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(true),
    sequelize_typescript_1.Default(null),
    sequelize_typescript_1.Column(sequelize_typescript_1.DataType.STRING(initializers_1.CONSTRAINTS_FIELDS.VIDEO_IMPORTS.TORRENT_NAME.max)),
    __metadata("design:type", String)
], VideoImportModel.prototype, "torrentName", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Default(null),
    sequelize_typescript_1.Is('VideoImportState', value => utils_1.throwIfNotValid(value, video_imports_1.isVideoImportStateValid, 'state')),
    sequelize_typescript_1.Column,
    __metadata("design:type", Number)
], VideoImportModel.prototype, "state", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(true),
    sequelize_typescript_1.Default(null),
    sequelize_typescript_1.Column(sequelize_typescript_1.DataType.TEXT),
    __metadata("design:type", String)
], VideoImportModel.prototype, "error", void 0);
__decorate([
    sequelize_typescript_1.ForeignKey(() => user_1.UserModel),
    sequelize_typescript_1.Column,
    __metadata("design:type", Number)
], VideoImportModel.prototype, "userId", void 0);
__decorate([
    sequelize_typescript_1.BelongsTo(() => user_1.UserModel, {
        foreignKey: {
            allowNull: false
        },
        onDelete: 'cascade'
    }),
    __metadata("design:type", user_1.UserModel)
], VideoImportModel.prototype, "User", void 0);
__decorate([
    sequelize_typescript_1.ForeignKey(() => video_1.VideoModel),
    sequelize_typescript_1.Column,
    __metadata("design:type", Number)
], VideoImportModel.prototype, "videoId", void 0);
__decorate([
    sequelize_typescript_1.BelongsTo(() => video_1.VideoModel, {
        foreignKey: {
            allowNull: true
        },
        onDelete: 'set null'
    }),
    __metadata("design:type", video_1.VideoModel)
], VideoImportModel.prototype, "Video", void 0);
__decorate([
    sequelize_typescript_1.AfterUpdate,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [VideoImportModel, Object]),
    __metadata("design:returntype", void 0)
], VideoImportModel, "deleteVideoIfFailed", null);
VideoImportModel = VideoImportModel_1 = __decorate([
    sequelize_typescript_1.DefaultScope({
        include: [
            {
                model: () => user_1.UserModel.unscoped(),
                required: true
            },
            {
                model: () => video_1.VideoModel.scope([video_1.ScopeNames.WITH_ACCOUNT_DETAILS, video_1.ScopeNames.WITH_TAGS]),
                required: false
            }
        ]
    }),
    sequelize_typescript_1.Table({
        tableName: 'videoImport',
        indexes: [
            {
                fields: ['videoId'],
                unique: true
            },
            {
                fields: ['userId']
            }
        ]
    })
], VideoImportModel);
exports.VideoImportModel = VideoImportModel;
