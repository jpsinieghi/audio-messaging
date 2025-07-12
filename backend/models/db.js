const bcrypt = require('bcryptjs');

const users = [
  {
    id: 1,
    username: 'admin',
    password: bcrypt.hashSync('admin123', 10),
    role: 'moderator'
  },
  {
    id: 2,
    username: 'user1',
    password: bcrypt.hashSync('user123', 10),
    role: 'user'
  }
];

const audioMessages = [];

module.exports = { users, audioMessages };