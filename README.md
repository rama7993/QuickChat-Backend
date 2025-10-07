# QuickChat Backend

A real-time chat application backend built with Node.js, Express, Socket.IO, and MongoDB.

## Features

- **Real-time messaging** via Socket.IO
- **User authentication** with JWT tokens
- **Private and group chats**
- **Typing indicators**
- **Online/offline status**
- **File uploads** (images, videos, audio, documents)
- **Message reactions, editing, and deletion**
- **Voice message recording**
- **Message search**
- **User management**

## Prerequisites

- Node.js (v18 or higher)
- MongoDB (local or cloud)
- npm or yarn

## Installation

1. Clone the repository and navigate to the backend directory:
```bash
cd "QuickChat backend/server"
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp env.example .env
```

4. Update `.env` file with your configuration:
```env
MONGO_URI=mongodb://localhost:27017/quickchat
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRATION=7d
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:4200,http://localhost:3000
```

## Running the Application

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The server will start on `http://localhost:3000` (or the port specified in your environment variables).

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/validate` - Validate token

### Users
- `GET /api/users` - Get all users
- `GET /api/users/me` - Get current user
- `PUT /api/users/:id` - Update user

### Messages
- `GET /api/messages/private/:userId` - Get private messages
- `GET /api/messages/group/:groupId` - Get group messages
- `POST /api/messages/private` - Send private message
- `POST /api/messages/group` - Send group message
- `POST /api/messages/:messageId/reaction` - Add reaction
- `PUT /api/messages/:messageId` - Edit message
- `DELETE /api/messages/:messageId` - Delete message
- `GET /api/messages/search/:query` - Search messages

### Groups
- `GET /api/groups` - Get user's groups
- `POST /api/groups` - Create group
- `GET /api/groups/:id` - Get group details
- `PUT /api/groups/:id` - Update group
- `DELETE /api/groups/:id` - Delete group

### Notifications
- `GET /api/notifications` - Get notifications
- `PUT /api/notifications/:id/read` - Mark notification as read

## Socket.IO Events

### Client to Server
- `join_room` - Join a chat room
- `leave_room` - Leave a chat room
- `send_message` - Send a message
- `start_typing` - Start typing indicator
- `stop_typing` - Stop typing indicator
- `upload_file` - Upload file
- `mark_message_read` - Mark message as read
- `update_message` - Update message
- `delete_message` - Delete message

### Server to Client
- `authenticated` - User authenticated
- `message_received` - New message received
- `message_updated` - Message updated
- `message_deleted` - Message deleted
- `user_typing` - User typing
- `user_stopped_typing` - User stopped typing
- `user_online` - User came online
- `user_offline` - User went offline
- `online_users` - List of online users
- `load_messages` - Load recent messages

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MONGO_URI` | MongoDB connection string | `mongodb://localhost:27017/quickchat` |
| `JWT_SECRET` | JWT secret key | `your-super-secret-jwt-key-change-this-in-production` |
| `JWT_EXPIRATION` | JWT expiration time | `7d` |
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment | `development` |
| `CORS_ORIGIN` | Allowed CORS origins | `http://localhost:4200,http://localhost:3000` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | - |
| `CLOUDINARY_API_KEY` | Cloudinary API key | - |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | - |

## File Uploads

The application supports file uploads through Socket.IO. Files are uploaded as base64 and can be stored either locally or on Cloudinary (if configured).

Supported file types:
- Images (jpg, png, gif, etc.)
- Videos (mp4, webm, etc.)
- Audio (mp3, wav, webm, etc.)
- Documents (pdf, doc, txt, etc.)

## Database Schema

### User
- `firstName`, `lastName` - User's name
- `email` - Unique email address
- `password` - Hashed password
- `username` - Unique username
- `photoUrl` - Profile picture URL
- `status` - Online status
- `lastSeen` - Last seen timestamp

### Message
- `sender` - Reference to User
- `receiver` - Reference to User (for private messages)
- `group` - Reference to Group (for group messages)
- `content` - Message content
- `type` - Message type (text, image, video, etc.)
- `attachments` - File attachments
- `timestamp` - Message timestamp
- `isRead` - Read status

### Group
- `name` - Group name
- `description` - Group description
- `avatar` - Group avatar URL
- `members` - Array of User references
- `admin` - Group admin User reference

## Testing

Run tests with:
```bash
npm test
```

## Linting

Run linting with:
```bash
npm run lint
```

Fix linting issues with:
```bash
npm run lint:fix
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License