const express = require('express');
const multer = require('multer');
const fs = require('fs');
require('dotenv').config();
const { google } = require('googleapis');

const PORT = process.env.PORT || 3000;
const FOLDER_ID = process.env.FOLDER_ID;
const KEYFILE = process.env.SERVICE_ACCOUNT_KEY_PATH || './service-account.json';

const auth = new google.auth.GoogleAuth({
  keyFile: KEYFILE,
  scopes: ['https://www.googleapis.com/auth/drive']
});
const drive = google.drive({ version: 'v3', auth });

const app = express();
const upload = multer({ dest: 'uploads/' });
app.use(express.static('public'));

app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const filePath = req.file.path;
    const fileName = req.file.originalname;
    const fileMetadata = { name: fileName, parents: [FOLDER_ID] };
    const media = { mimeType: req.file.mimetype, body: fs.createReadStream(filePath) };
    const response = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id, name'
    });
    fs.unlinkSync(filePath);
    res.json({ success: true, file: response.data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/files', async (req, res) => {
  try {
    const q = `'${FOLDER_ID}' in parents and trashed = false`;
    const response = await drive.files.list({ q, fields: 'files(id, name, mimeType, size, modifiedTime)' });
    res.json({ files: response.data.files });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/download/:fileId', async (req, res) => {
  try {
    const fileId = req.params.fileId;
    const meta = await drive.files.get({ fileId, fields: 'name' });
    const name = meta.data.name;
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    const stream = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
    stream.data.pipe(res);
  } catch (err) {
    console.error(err);
    res.status(500).send('Download error: ' + err.message);
  }
});

app.listen(PORT, () => console.log(`Server berjalan di http://localhost:${PORT}`));