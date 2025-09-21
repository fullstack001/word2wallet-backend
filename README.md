# Word2Wallet Backend API

A Node.js, Express, MongoDB, and TypeScript backend API for a course management system with EPUB3 support.

## Features

- **Authentication & Authorization**: JWT-based authentication with role-based access control (Admin/User)
- **User Management**: User registration, login, profile management
- **Subject Management**: CRUD operations for course subjects
- **Course Management**: CRUD operations for courses with EPUB3 file support
- **File Upload**: EPUB and thumbnail image upload functionality
- **Security**: Helmet, CORS, rate limiting, input validation
- **TypeScript**: Full TypeScript support with strict type checking

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Language**: TypeScript
- **Authentication**: JWT (JSON Web Tokens)
- **File Upload**: Multer
- **Validation**: Express Validator
- **Security**: Helmet, CORS, Rate Limiting

## Prerequisites

- Node.js (v16 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn

## Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd word2wallet-backend
```

2. Install dependencies:

```bash
npm install
```

3. Create environment file:

```bash
cp env.example .env
```

4. Configure environment variables in `.env`:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/word2wallet

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRE=7d
JWT_REFRESH_SECRET=your-super-secret-refresh-key-here
JWT_REFRESH_EXPIRE=30d

# File Upload Configuration
MAX_FILE_SIZE=50MB
UPLOAD_PATH=./uploads
EPUB_UPLOAD_PATH=./uploads/epubs

# CORS Configuration
FRONTEND_URL=http://localhost:3000
```

5. Create upload directories:

```bash
mkdir -p uploads/epubs uploads/thumbnails
```

## Running the Application

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm run build
npm start
```

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/refresh-token` - Refresh access token
- `GET /api/auth/profile` - Get current user profile
- `PUT /api/auth/profile` - Update user profile
- `PUT /api/auth/change-password` - Change password
- `POST /api/auth/logout` - Logout user

### Users (Admin only)

- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user
- `PATCH /api/users/:id/toggle-status` - Toggle user status

### Subjects

- `GET /api/subjects` - Get all subjects (authenticated)
- `GET /api/subjects/active` - Get active subjects (public)
- `GET /api/subjects/:slug` - Get subject by slug (public)
- `GET /api/subjects/id/:id` - Get subject by ID (authenticated)
- `POST /api/subjects` - Create subject (admin only)
- `PUT /api/subjects/:id` - Update subject (admin only)
- `DELETE /api/subjects/:id` - Delete subject (admin only)
- `PATCH /api/subjects/:id/toggle-status` - Toggle subject status (admin only)

### Courses

- `GET /api/courses` - Get all courses (authenticated)
- `GET /api/courses/published` - Get published courses (public)
- `GET /api/courses/:slug` - Get course by slug (public)
- `GET /api/courses/id/:id` - Get course by ID (authenticated)
- `GET /api/courses/:id/download` - Download EPUB file (public)
- `POST /api/courses` - Create course (admin only)
- `PUT /api/courses/:id` - Update course (admin only)
- `DELETE /api/courses/:id` - Delete course (admin only)
- `PATCH /api/courses/:id/toggle-published` - Toggle published status (admin only)
- `POST /api/courses/:id/upload-epub` - Upload EPUB file (admin only)
- `POST /api/courses/:id/upload-thumbnail` - Upload thumbnail (admin only)

## User Roles

- **Admin**: Full access to all endpoints, can manage users, subjects, and courses
- **User**: Limited access, can view published content

## File Upload

### EPUB Files

- Supported formats: .epub
- Maximum size: 50MB
- Upload endpoint: `POST /api/courses/:id/upload-epub`

### Thumbnail Images

- Supported formats: JPEG, PNG, WebP
- Maximum size: 5MB
- Upload endpoint: `POST /api/courses/:id/upload-thumbnail`

## Security Features

- JWT-based authentication
- Role-based authorization
- Password hashing with bcrypt
- Rate limiting
- CORS protection
- Helmet security headers
- Input validation and sanitization
- File type validation

## Database Models

### User

- email, password, firstName, lastName, role, isActive, lastLogin

### Subject

- name, description, slug, isActive, createdBy

### Course

- title, description, slug, subject, epubFile, epubMetadata, thumbnail, isActive, isPublished, createdBy

## Error Handling

The API uses a centralized error handling system with:

- Custom error classes
- Consistent error response format
- Proper HTTP status codes
- Detailed error messages in development mode

## Validation

All input is validated using express-validator with:

- Email format validation
- Password strength requirements
- File type and size validation
- Required field validation
- Length and format constraints

## Scripts

- `npm run dev` - Start development server with nodemon
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint errors
- `npm test` - Run tests

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License
