const axios = require('axios');

async function testLogin() {
  try {
    console.log('Testing backend connection...');
    const response = await axios.post('http://127.0.0.1:3000/api/auth/login', {
      username: 'user1',
      password: 'user123'
    });
    console.log('Success:', response.data);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testLogin();