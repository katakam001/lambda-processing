const { S3Client, GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
const s3 = new S3Client({ region: process.env.AWS_REGION });

async function getFileFromS3(bucketName, fileName) {
    const command = new GetObjectCommand({ Bucket: bucketName, Key: fileName });
    return await s3.send(command);
}

async function uploadFileToS3(bucketName, key, buffer, contentType, metadata = {}) {
    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        Metadata: metadata
    });
    return await s3.send(command);
}

module.exports = {
    getFileFromS3,
    uploadFileToS3
};
