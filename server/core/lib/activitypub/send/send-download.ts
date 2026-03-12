import {
	ActivityAudience,
	ActivityDownload,
} from "@peertube/peertube-models"
import { VideoViewsManager } from "@server/lib/views/video-views-manager.js"
import {
	MActorAudience,
	MActorLight,
	MVideoImmutable,
	MVideoUrl,
} from "@server/types/models/index.js"
import { Transaction } from "sequelize"
import { logger } from "../../../helpers/logger.js"
import { audiencify, getPublicAudience } from "../audience.js"
import { getDownloadsActivityPubUrl } from "../url.js"
import { sendVideoRelatedActivity } from "./shared/send-utils.js"

async function sendDownload(options: {
	byActor: MActorLight;
	video: MVideoImmutable;
	downloadsCount ? : number;
	transaction ? : Transaction;
}) {
	const { byActor, downloadsCount, video, transaction } = options

	logger.info("Creating job to send downloads of %s.", video.url)

	const activityBuilder = (audience: ActivityAudience) => {
		const url = getDownloadsActivityPubUrl(byActor, video)

		return buildDownloadActivity({
			url,
			byActor,
			video,
			audience,
			downloadsCount,
		})
	}

	return sendVideoRelatedActivity(activityBuilder, {
		byActor,
		video,
		transaction,
		contextType: "Download",
		parallelizable: true,
	})
}

// ---------------------------------------------------------------------------

export { sendDownload }

// ---------------------------------------------------------------------------

function buildDownloadActivity(options: {
	url: string;
	byActor: MActorAudience;
	video: MVideoUrl;
	downloadsCount ? : number;
	audience ? : ActivityAudience;
}): ActivityDownload {
	const {
		url,
		byActor,
		downloadsCount,
		video,
		audience = getPublicAudience(byActor),
	} = options

	const base = {
		id: url,
		type: "Download" as "Download",
		actor: byActor.url,
		object: video.url,
	}

	if (downloadsCount === undefined) {
		return audiencify(base, audience)
	}

	return audiencify({
			...base,

			expires: new Date(
				VideoViewsManager.Instance.buildViewerExpireTime(),
			).toISOString(),

			result: {
				interactionType: "DownloadAction",
				type: "InteractionCounter",
				userInteractionCount: downloadsCount,
			},
		},
		audience,
	)
}
