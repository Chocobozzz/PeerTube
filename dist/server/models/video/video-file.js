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
var VideoFileModel_1;
const lodash_1 = require("lodash");
const sequelize_typescript_1 = require("sequelize-typescript");
const videos_1 = require("../../helpers/custom-validators/videos");
const initializers_1 = require("../../initializers");
const utils_1 = require("../utils");
const video_1 = require("./video");
const Sequelize = require("sequelize");
const video_redundancy_1 = require("../redundancy/video-redundancy");
let VideoFileModel = VideoFileModel_1 = class VideoFileModel extends sequelize_typescript_1.Model {
    static isInfohashExists(infoHash) {
        const query = 'SELECT 1 FROM "videoFile" WHERE "infoHash" = $infoHash LIMIT 1';
        const options = {
            type: Sequelize.QueryTypes.SELECT,
            bind: { infoHash },
            raw: true
        };
        return video_1.VideoModel.sequelize.query(query, options)
            .then(results => {
            return results.length === 1;
        });
    }
    static loadWithVideo(id) {
        const options = {
            include: [
                {
                    model: video_1.VideoModel.unscoped(),
                    required: true
                }
            ]
        };
        return VideoFileModel_1.findById(id, options);
    }
    hasSameUniqueKeysThan(other) {
        return this.fps === other.fps &&
            this.resolution === other.resolution &&
            this.videoId === other.videoId;
    }
};
__decorate([
    sequelize_typescript_1.CreatedAt,
    __metadata("design:type", Date)
], VideoFileModel.prototype, "createdAt", void 0);
__decorate([
    sequelize_typescript_1.UpdatedAt,
    __metadata("design:type", Date)
], VideoFileModel.prototype, "updatedAt", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Is('VideoFileResolution', value => utils_1.throwIfNotValid(value, videos_1.isVideoFileResolutionValid, 'resolution')),
    sequelize_typescript_1.Column,
    __metadata("design:type", Number)
], VideoFileModel.prototype, "resolution", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Is('VideoFileSize', value => utils_1.throwIfNotValid(value, videos_1.isVideoFileSizeValid, 'size')),
    sequelize_typescript_1.Column(sequelize_typescript_1.DataType.BIGINT),
    __metadata("design:type", Number)
], VideoFileModel.prototype, "size", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Column(sequelize_typescript_1.DataType.ENUM(lodash_1.values(initializers_1.CONSTRAINTS_FIELDS.VIDEOS.EXTNAME))),
    __metadata("design:type", String)
], VideoFileModel.prototype, "extname", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Is('VideoFileSize', value => utils_1.throwIfNotValid(value, videos_1.isVideoFileInfoHashValid, 'info hash')),
    sequelize_typescript_1.Column,
    __metadata("design:type", String)
], VideoFileModel.prototype, "infoHash", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Default(-1),
    sequelize_typescript_1.Is('VideoFileFPS', value => utils_1.throwIfNotValid(value, videos_1.isVideoFPSResolutionValid, 'fps')),
    sequelize_typescript_1.Column,
    __metadata("design:type", Number)
], VideoFileModel.prototype, "fps", void 0);
__decorate([
    sequelize_typescript_1.ForeignKey(() => video_1.VideoModel),
    sequelize_typescript_1.Column,
    __metadata("design:type", Number)
], VideoFileModel.prototype, "videoId", void 0);
__decorate([
    sequelize_typescript_1.BelongsTo(() => video_1.VideoModel, {
        foreignKey: {
            allowNull: false
        },
        onDelete: 'CASCADE'
    }),
    __metadata("design:type", video_1.VideoModel)
], VideoFileModel.prototype, "Video", void 0);
__decorate([
    sequelize_typescript_1.HasMany(() => video_redundancy_1.VideoRedundancyModel, {
        foreignKey: {
            allowNull: false
        },
        onDelete: 'CASCADE',
        hooks: true
    }),
    __metadata("design:type", Array)
], VideoFileModel.prototype, "RedundancyVideos", void 0);
VideoFileModel = VideoFileModel_1 = __decorate([
    sequelize_typescript_1.Table({
        tableName: 'videoFile',
        indexes: [
            {
                fields: ['videoId']
            },
            {
                fields: ['infoHash']
            },
            {
                fields: ['videoId', 'resolution', 'fps'],
                unique: true
            }
        ]
    })
], VideoFileModel);
exports.VideoFileModel = VideoFileModel;
//# sourceMappingURL=video-file.js.map