const AWS = require('aws-sdk');
const Client = require('ssh2-sftp-client');
const fs = require('fs');
const os = require('os');
const path = require('path')

const s3_bucket = process.env.S3_BUCKET;
const s3_prefix = 'files/';
const s3_storage_class = 'STANDARD_IA';
const s3_content_type = 'text/csv';

const host = 'mozilla.brickftp.com';
const port = 22;
const username = process.env.SFTP_USERNAME;
const password = process.env.SFTP_PASSWORD;
const private_key = process.env.SFTP_PRIVATE_KEY ? Buffer.from(process.env.SFTP_PRIVATE_KEY, 'base64') : null;

const dry_run = process.argv[2] == "--dry-run";

(async () => {
  let S3 = new AWS.S3({
    params: {
      Bucket: s3_bucket,
      ContentType: s3_content_type,
      Prefix: s3_prefix,
      StorageClass: s3_storage_class
    }
  });

  let s3_response = await S3.listObjectsV2({}).promise();

  if (s3_response.IsTruncated) {
    // FIXME I'm too lazy to figure out how to list >1000 objects with promises
    throw new Error("S3 file listing is truncated")
  }

  let s3_file_list = s3_response.Contents.reduce((obj, item) => {
    obj[item.Key.substring(6)] = item.Size;
    return obj;
  }, {});

  let sftp = new Client();

  await sftp.connect({
      host: host,
      port: 22,
      username: username,
      password: password,
      privateKey: private_key,
  });
  let sftp_file_list = await sftp.list('/etl/deg-exacttarget');

  let files_to_download = sftp_file_list.filter((rf) => {
    return rf.name.includes('FXA_Email_Events') && !s3_file_list[rf.name] && s3_file_list[rf.name] != rf.size;
  });

  console.log(files_to_download.map(f => f.name));

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fxa-brickftp-copy'));

  for (let file of files_to_download) {
    console.log(`Writing ${file.size} bytes to s3://${s3_bucket}/files/${file.name}`);
    if (dry_run) {
      continue;
    }

    const localPath = path.join(tempDir, file.name);
    const remotePath = '/etl/deg-exacttarget/' + file.name;
    const tempFile = await sftp.fastGet(remotePath, localPath);

    console.log(tempFile);

    let ws = await S3.putObject({
      Body: fs.createReadStream(localPath),
      Key: 'files/' + file.name
    }).promise();

    console.log(ws);

    fs.unlinkSync(localPath);
  }

  fs.rmdirSync(tempDir);
  await sftp.end();
})();
