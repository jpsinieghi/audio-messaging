const bcrypt = require('bcryptjs');

// Test password hashing
const password = 'user123';
const hash = bcrypt.hashSync(password, 10);
console.log('Generated hash:', hash);

// Test verification
const isValid = bcrypt.compareSync(password, hash);
console.log('Password verification:', isValid);

// Test with existing hash from db
const { users } = require('./backend/models/db');
const user1 = users.find(u => u.username === 'user1');
console.log('User1 from db:', user1);

if (user1) {
  const dbPasswordValid = bcrypt.compareSync('user123', user1.password);
  console.log('DB password valid:', dbPasswordValid);
}