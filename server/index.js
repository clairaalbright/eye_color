const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { analyzeEyeColor } = require('./colorAnalyzer');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /image\/(jpeg|jpg|png|webp)/;
    if (allowed.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed.'));
    }
  }
});

app.post('/api/analyze', upload.single('image'), async (req, res) => {
  try {
    let buffer = null;
    if (req.file && req.file.buffer) {
      buffer = req.file.buffer;
    } else if (req.body && req.body.image) {
      const base64 = req.body.image.replace(/^data:image\/\w+;base64,/, '');
      buffer = Buffer.from(base64, 'base64');
    }
    if (!buffer || buffer.length === 0) {
      return res.status(400).json({ error: 'No image provided. Send as multipart file "image" or JSON body { "image": "data:image/...;base64,..." }' });
    }
    const result = await analyzeEyeColor(buffer);
    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Analysis failed.' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Eye Color Identifier server running at http://localhost:${PORT}`);
});
