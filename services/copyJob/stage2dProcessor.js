const processStageBundle1b = require("./stage1bProcessor"); // or rename to common processor

async function processStageBundle(fileData, metadata, s3Key) {
  console.log(`📦 Processing Stage1c bundle...`);
  return await processStageBundle1b.processStageBundle(fileData, metadata, s3Key);


}
module.exports = { processStageBundle };
