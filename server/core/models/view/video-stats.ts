import { MAX_SQL_DELETE_ITEMS } from "@server/initializers/constants.js";
import { literal, Op, QueryTypes } from "sequelize";
import {
	AllowNull,
	BelongsTo,
	Column,
	CreatedAt,
	DataType,
	Default,
	ForeignKey,
	Table,
} from "sequelize-typescript";
import { safeBulkDestroy, SequelizeModel } from "../shared/index.js";
import { VideoModel } from "../video/video.js";
import {
	VideoDownloadStatsTimeserieMetric,
	VideoStatsTimeserie,
} from "@peertube/peertube-models";
import { MVideo } from "@server/types/models/index.js";
import { buildGroupByAndBoundaries } from "@server/lib/timeserie.js";

/**
 * Aggregate views of all videos federated with our instance
 * Mainly used by the trending/hot algorithms
 */

@Table({
	tableName: "videoStats",
	updatedAt: false,
	indexes: [{
			fields: ["videoId"],
		},
		{
			fields: ["startDate"],
		},
	],
})
export class VideoStatsModel extends SequelizeModel < VideoStatsModel > {
	@CreatedAt
	declare createdAt: Date;

	@AllowNull(false)
	@Column(DataType.DATE)
	declare startDate: Date;

	@AllowNull(false)
	@Column(DataType.DATE)
	declare endDate: Date;

	@AllowNull(false)
	@Default(0)
	@Column
	declare views: number;

	@AllowNull(false)
	@Default(0)
	@Column
	declare downloads: number;

	@ForeignKey(() => VideoModel)
	@Column
	declare videoId: number;

	@BelongsTo(() => VideoModel, {
		foreignKey: {
			allowNull: false,
		},
		onDelete: "CASCADE",
	})
	declare Video: Awaited < VideoModel > ;

	static removeOldRemoteViews(beforeDate: string) {
		return safeBulkDestroy(() => {
			return VideoStatsModel.destroy({
				where: {
					startDate: {
						[Op.lt]: beforeDate,
					},
					videoId: {
						[Op.in]: literal(
							'(SELECT "id" FROM "video" WHERE "remote" IS TRUE)',
						),
					},
				},
				limit: MAX_SQL_DELETE_ITEMS,
			});
		});
	}

	static removeOldLocalViews(beforeDate: string) {
		return safeBulkDestroy(() => {
			return VideoStatsModel.destroy({
				where: {
					startDate: {
						[Op.lt]: beforeDate,
					},
					videoId: {
						[Op.in]: literal(
							'(SELECT "id" FROM "video" WHERE "remote" IS FALSE)',
						),
					},
				},
				limit: MAX_SQL_DELETE_ITEMS,
			});
		});
	}

	static async getTimeserieStats(options: {
		video: MVideo;
		metric: VideoDownloadStatsTimeserieMetric;
		startDate: string;
		endDate: string;
	}): Promise < VideoStatsTimeserie > {
		const { video } = options;

		const { groupInterval, startDate, endDate } = buildGroupByAndBoundaries(
			options.startDate,
			options.endDate,
		);

		const query = `WITH "intervals" AS (
      SELECT
        "time" AS "startDate", "time" + :groupInterval::interval as "endDate"
      FROM
        generate_series(:startDate::timestamptz, :endDate::timestamptz, :groupInterval::interval) serie("time")
    )
    SELECT
      "intervals"."startDate" AS date, COALESCE("videoStats"."downloads", 0) AS value
    FROM
      "intervals"
      LEFT JOIN "videoStats" ON "videoStats"."videoId" = :videoId
        AND
          "videoStats"."startDate" <= "intervals"."endDate"
        AND
          "videoStats"."startDate" >= "intervals"."startDate"
    ORDER BY
      "intervals"."startDate"
    `;

		const queryOptions = {
			type: QueryTypes.SELECT as QueryTypes.SELECT,
			replacements: {
				startDate,
				endDate,
				groupInterval,
				videoId: video.id,
			},
		};

		const rows = await VideoStatsModel.sequelize.query < any > (
			query,
			queryOptions,
		);

		return {
			groupInterval,
			data: rows.map((r) => ({
				date: r.date,
				value: parseInt(r.value),
			})),
		};
	}
}
