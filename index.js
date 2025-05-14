const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");

const s3 = new S3Client({ region: "ap-south-2" }); // Ensure correct region

exports.handler = async (event) => {
    try {
        const record = event.Records[0];  
        const bucketName = record.s3.bucket.name;
        const fileName = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

        console.log("Reading file:", fileName);

        const command = new GetObjectCommand({ Bucket: bucketName, Key: fileName });
        const fileData = await s3.send(command);

        console.log("File content:", await streamToString(fileData.Body));

        return { statusCode: 200, body: "File read successfully" };
    } catch (error) {
        console.error("Error reading file:", error);
        return { statusCode: 500, body: "Internal Server Error" };
    }
};

// Helper function to convert stream to string
const streamToString = async (stream) => {
    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString("utf-8");
};
