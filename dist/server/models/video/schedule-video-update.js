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
var ScheduleVideoUpdateModel_1;
const sequelize_typescript_1 = require("sequelize-typescript");
const video_1 = require("./video");
let ScheduleVideoUpdateModel = ScheduleVideoUpdateModel_1 = class ScheduleVideoUpdateModel extends sequelize_typescript_1.Model {
    static areVideosToUpdate() {
        const query = {
            logging: false,
            attributes: ['id'],
            where: {
                updateAt: {
                    [sequelize_typescript_1.Sequelize.Op.lte]: new Date()
                }
            }
        };
        return ScheduleVideoUpdateModel_1.findOne(query)
            .then(res => !!res);
    }
    static listVideosToUpdate(t) {
        const query = {
            where: {
                updateAt: {
                    [sequelize_typescript_1.Sequelize.Op.lte]: new Date()
                }
            },
            include: [
                {
                    model: video_1.VideoModel.scope([
                        video_1.ScopeNames.WITH_FILES,
                        video_1.ScopeNames.WITH_ACCOUNT_DETAILS
                    ])
                }
            ],
            transaction: t
        };
        return ScheduleVideoUpdateModel_1.findAll(query);
    }
    static deleteByVideoId(videoId, t) {
        const query = {
            where: {
                videoId
            },
            transaction: t
        };
        return ScheduleVideoUpdateModel_1.destroy(query);
    }
    toFormattedJSON() {
        return {
            updateAt: this.updateAt,
            privacy: this.privacy || undefined
        };
    }
};
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Default(null),
    sequelize_typescript_1.Column,
    __metadata("design:type", Date)
], ScheduleVideoUpdateModel.prototype, "updateAt", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(true),
    sequelize_typescript_1.Default(null),
    sequelize_typescript_1.Column,
    __metadata("design:type", Number)
], ScheduleVideoUpdateModel.prototype, "privacy", void 0);
__decorate([
    sequelize_typescript_1.CreatedAt,
    __metadata("design:type", Date)
], ScheduleVideoUpdateModel.prototype, "createdAt", void 0);
__decorate([
    sequelize_typescript_1.UpdatedAt,
    __metadata("design:type", Date)
], ScheduleVideoUpdateModel.prototype, "updatedAt", void 0);
__decorate([
    sequelize_typescript_1.ForeignKey(() => video_1.VideoModel),
    sequelize_typescript_1.Column,
    __metadata("design:type", Number)
], ScheduleVideoUpdateModel.prototype, "videoId", void 0);
__decorate([
    sequelize_typescript_1.BelongsTo(() => video_1.VideoModel, {
        foreignKey: {
            allowNull: false
        },
        onDelete: 'cascade'
    }),
    __metadata("design:type", video_1.VideoModel)
], ScheduleVideoUpdateModel.prototype, "Video", void 0);
ScheduleVideoUpdateModel = ScheduleVideoUpdateModel_1 = __decorate([
    sequelize_typescript_1.Table({
        tableName: 'scheduleVideoUpdate',
        indexes: [
            {
                fields: ['videoId'],
                unique: true
            },
            {
                fields: ['updateAt']
            }
        ]
    })
], ScheduleVideoUpdateModel);
exports.ScheduleVideoUpdateModel = ScheduleVideoUpdateModel;
//# sourceMappingURL=schedule-video-update.js.map