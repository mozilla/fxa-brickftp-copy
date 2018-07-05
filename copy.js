const AWS = require('aws-sdk');
const Client = require('ssh2-sftp-client');
const fs = require('fs');

const s3_bucket = process.env.S3_BUCKET;

const host = 'mozilla.brickftp.com';
const port = 22;
const username = process.env.SFTP_USERNAME;
const password = process.env.SFTP_PASSWORD;

(async () => {

  let sftp = new Client();

  await sftp.connect({
      host: host,
      port: 22,
      username: username,
      password: password
  });
  let remote_file_list = await sftp.list('/etl/deg-exacttarget');

  let files_to_download = remote_file_list.filter((rf) => {
    if (!rf.name.includes('FXA_Email_Events')) {
      return false;
    }
    try {
      let lf = fs.statSync('files/' + rf.name);
      return rf.size != lf.size;
    } catch (ex) {
      return true;
    }
  });

  console.log(files_to_download);

  for (let file of files_to_download) {
    let eof = new Promise(async (resolve, reject) => {
      console.log('Writing %d bytes to files/%s', file.size, file.name);
      let rs = await sftp.get('/etl/deg-exacttarget/' + file.name, false, null);
      let ws = fs.createWriteStream('files/' + file.name, { encoding: 'binary' });

      ws.on('close', resolve);
      ws.on('error', reject);

      rs.pipe(ws);
    });

    await eof;
  }

  await sftp.end();
})();
