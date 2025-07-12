const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pool } = require('../models/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    console.log('Saving to:', uploadsDir);
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const filename = Date.now() + '.m4a';
    console.log('Generated filename:', filename);
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
      [req.user.id, req.user.username, req.file.filename]
    );
    
    console.log('Message saved to DB:', result.rows[0]);
    res.json({ message: 'Audio sent successfully', filename: req.file.filename });
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
      'UPDATE audio_messages SET responded = true, response_filename = $1, response_timestamp = CURRENT_TIMESTAMP, filename = NULL WHERE id = $2 RETURNING *',
      [req.file.filename, messageId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    // Delete the user's audio file
    if (originalMessage.rows[0]?.filename) {
      const filePath = path.join(uploadsDir, originalMessage.rows[0].filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('Deleted user audio file:', originalMessage.rows[0].filename);
      }
    }
    
    res.json({ message: 'Response sent successfully' });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to save response' });
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
      'UPDATE audio_messages SET responded = true, text_response = $1, response_timestamp = CURRENT_TIMESTAMP, filename = NULL WHERE id = $2 RETURNING *',
      [textResponse, messageId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    // Delete the user's audio file
    if (originalMessage.rows[0]?.filename) {
      const filePath = path.join(uploadsDir, originalMessage.rows[0].filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('Deleted user audio file:', originalMessage.rows[0].filename);
      }
    }
    
    res.json({ message: 'Text response sent successfully' });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to save text response' });
  }
});

module.exports = router;