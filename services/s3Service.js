const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const s3 = new S3Client({ region: "ap-south-2" });

async function getFileFromS3(bucketName, fileName) {
    const command = new GetObjectCommand({ Bucket: bucketName, Key: fileName });
    return await s3.send(command);
}

module.exports = { getFileFromS3 };