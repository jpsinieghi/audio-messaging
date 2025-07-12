# AudioChat - Audio Messaging App

A minimal audio messaging application with user and moderator environments.

## Features

- **User Environment**: Record and send 30-second audio messages
- **Moderator Environment**: Listen to messages and respond with audio
- JWT Authentication with role-based access
- Real-time audio recording and playback

## Demo Accounts

- **User**: username: `user1`, password: `user123`
- **Moderator**: username: `admin`, password: `admin123`

## Setup

### Backend
```bash
cd backend
npm install
npm start
```

### Frontend (React Native with Expo)
```bash
cd frontend
npm install
npx expo start
```

## API Endpoints

- `POST /api/auth/login` - User authentication
- `POST /api/audio/send` - Send audio message
- `GET /api/audio/messages` - Get messages
- `POST /api/audio/respond/:id` - Moderator response

## Architecture

- **Backend**: Node.js/Express with in-memory database
- **Frontend**: React Native with Expo
- **Audio**: expo-av for recording/playback
- **Authentication**: JWT tokens with AsyncStorage