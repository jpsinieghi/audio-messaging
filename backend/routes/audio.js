const express = require('express');
const multer = require('multer');
const multerS3 = require('multer-s3');
const AWS = require('aws-sdk');
const { pool } = require('../models/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Configure AWS
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const storage = multerS3({
  s3: s3,
  bucket: process.env.S3_BUCKET_NAME,
  metadata: function (req, file, cb) {
    cb(null, {fieldName: file.fieldname});
  },
  key: function (req, file, cb) {
    const filename = `audio/${Date.now()}.m4a`;
    console.log('Generated S3 key:', filename);
    cb(null, filename);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    console.log('File received:', file);
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files allowed'));
    }
  }
}).single('audio');

// Custom upload handler with error handling
const handleUpload = (req, res, next) => {
  upload(req, res, (err) => {
    if (err) {
      console.error('Upload error:', err);
      return res.status(400).json({ error: err.message });
    }
    next();
  });
};

router.post('/send', authenticateToken, handleUpload, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file provided' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO audio_messages (user_id, username, filename) VALUES ($1, $2, $3) RETURNING *',
      [req.user.id, req.user.username, req.file.key]
    );
    
    console.log('Message saved to DB:', result.rows[0]);
    res.json({ message: 'Audio sent successfully', filename: req.file.key, url: req.file.location });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to save message' });
  }
});

router.get('/messages', authenticateToken, async (req, res) => {
  try {
    let query, params;
    
    if (req.user.role === 'moderator') {
      query = 'SELECT * FROM audio_messages ORDER BY timestamp DESC';
      params = [];
    } else {
      query = 'SELECT * FROM audio_messages WHERE user_id = $1 ORDER BY timestamp DESC';
      params = [req.user.id];
    }
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

router.post('/respond/:id', authenticateToken, handleUpload, async (req, res) => {
  if (req.user.role !== 'moderator') {
    return res.status(403).json({ error: 'Only moderators can respond' });
  }

  try {
    const messageId = parseInt(req.params.id);
    
    // Get the original message to delete the user's audio file
    const originalMessage = await pool.query('SELECT filename FROM audio_messages WHERE id = $1', [messageId]);
    
    const result = await pool.query(
      'UPDATE audio_messages SET responded = true, response_filename = $1, response_timestamp = CURRENT_TIMESTAMP, filename = NULL, moderator_name = $3 WHERE id = $2 RETURNING *',
      [req.file.key, messageId, req.user.username]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    // Delete the user's audio file from S3
    if (originalMessage.rows[0]?.filename) {
      try {
        await s3.deleteObject({
          Bucket: process.env.S3_BUCKET_NAME,
          Key: originalMessage.rows[0].filename
        }).promise();
        console.log('Deleted user audio file from S3:', originalMessage.rows[0].filename);
      } catch (deleteError) {
        console.error('Error deleting S3 file:', deleteError);
      }
    }
    
    res.json({ message: 'Response sent successfully' });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to save response' });
  }
});

// Generate signed URL for audio playback
router.get('/play/*', authenticateToken, async (req, res) => {
  try {
    const s3Key = req.params[0]; // Gets the full path after /play/
    console.log('Generating signed URL for S3 key:', s3Key);
    
    const signedUrl = s3.getSignedUrl('getObject', {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: s3Key,
      Expires: 3600 // 1 hour
    });
    res.json({ url: signedUrl });
  } catch (error) {
    console.error('Error generating signed URL:', error);
    res.status(500).json({ error: 'Failed to generate audio URL' });
  }
});

// Delete message endpoint for users
router.delete('/message/:id', authenticateToken, async (req, res) => {
  try {
    const messageId = parseInt(req.params.id);
    
    // Get message to verify ownership and get filenames
    const message = await pool.query('SELECT * FROM audio_messages WHERE id = $1 AND user_id = $2', [messageId, req.user.id]);
    
    if (message.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found or not authorized' });
    }
    
    const messageData = message.rows[0];
    
    // Delete audio files from S3 if they exist
    if (messageData.filename) {
      try {
        await s3.deleteObject({
          Bucket: process.env.S3_BUCKET_NAME,
          Key: messageData.filename
        }).promise();
        console.log('Deleted user audio file from S3:', messageData.filename);
      } catch (deleteError) {
        console.error('Error deleting user S3 file:', deleteError);
      }
    }
    
    if (messageData.response_filename) {
      try {
        await s3.deleteObject({
          Bucket: process.env.S3_BUCKET_NAME,
          Key: messageData.response_filename
        }).promise();
        console.log('Deleted response audio file from S3:', messageData.response_filename);
      } catch (deleteError) {
        console.error('Error deleting response S3 file:', deleteError);
      }
    }
    
    // Delete the message from database
    await pool.query('DELETE FROM audio_messages WHERE id = $1', [messageId]);
    
    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

router.post('/respond-text/:id', authenticateToken, async (req, res) => {
  console.log('Text response request:', { messageId: req.params.id, body: req.body, user: req.user });
  
  if (req.user.role !== 'moderator') {
    return res.status(403).json({ error: 'Only moderators can respond' });
  }

  try {
    const messageId = parseInt(req.params.id);
    const { textResponse } = req.body;
    
    console.log('Processing text response:', { messageId, textResponse });
    
    // Get the original message to delete the user's audio file
    const originalMessage = await pool.query('SELECT filename FROM audio_messages WHERE id = $1', [messageId]);
    
    const result = await pool.query(
      'UPDATE audio_messages SET responded = true, text_response = $1, response_timestamp = CURRENT_TIMESTAMP, filename = NULL, moderator_name = $3 WHERE id = $2 RETURNING *',
      [textResponse, messageId, req.user.username]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    // Delete the user's audio file from S3
    if (originalMessage.rows[0]?.filename) {
      try {
        await s3.deleteObject({
          Bucket: process.env.S3_BUCKET_NAME,
          Key: originalMessage.rows[0].filename
        }).promise();
        console.log('Deleted user audio file from S3:', originalMessage.rows[0].filename);
      } catch (deleteError) {
        console.error('Error deleting S3 file:', deleteError);
      }
    }
    
    res.json({ message: 'Text response sent successfully' });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to save text response' });
  }
});

module.exports = router;