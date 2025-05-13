const AWS = require("aws-sdk");

const s3 = new AWS.S3();

exports.handler = async (event) => {
    try {
        const record = event.Records[0];
        const bucketName = record.s3.bucket.name;
        const fileName = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

        console.log("File uploaded:", fileName);

        return { statusCode: 200, body: `Processed file: ${fileName}` };
    } catch (error) {
        console.error("Error processing file:", error);
        return { statusCode: 500, body: "Internal Server Error" };
    }
};
