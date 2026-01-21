import { isTestOrDevInstance } from "@peertube/peertube-node-utils";
import { logger } from "../../../helpers/logger.js";

async function processVideosDownloadsStats() {
  const lastHour = new Date();

  // In test mode, we run this function multiple times per hour, so we don't want the values of the previous hour
  if (!isTestOrDevInstance()) lastHour.setHours(lastHour.getHours() - 1);

  const hour = lastHour.getHours();

  logger.info("Processing videos downloads stats in job for hour %d.", hour);
}

// ---------------------------------------------------------------------------

export {
  processVideosDownloadsStats
};
