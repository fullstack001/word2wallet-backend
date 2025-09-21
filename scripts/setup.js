#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

console.log("🚀 Setting up Word2Wallet Backend...\n");

// Create necessary directories
const directories = ["uploads", "uploads/epubs", "uploads/thumbnails", "logs"];

console.log("📁 Creating directories...");
directories.forEach((dir) => {
  const dirPath = path.join(__dirname, "..", dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`   ✅ Created: ${dir}`);
  } else {
    console.log(`   ⚠️  Already exists: ${dir}`);
  }
});

// Create .env file if it doesn't exist
const envPath = path.join(__dirname, "..", ".env");
const envExamplePath = path.join(__dirname, "..", "env.example");

if (!fs.existsSync(envPath)) {
  if (fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envPath);
    console.log("   ✅ Created .env file from env.example");
  } else {
    // Create a basic .env file
    const envContent = `# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/word2wallet

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here-change-this-in-production
JWT_EXPIRE=7d
JWT_REFRESH_SECRET=your-super-secret-refresh-key-here-change-this-in-production
JWT_REFRESH_EXPIRE=30d

# File Upload Configuration
MAX_FILE_SIZE=50MB
UPLOAD_PATH=./uploads
EPUB_UPLOAD_PATH=./uploads/epubs

# CORS Configuration
FRONTEND_URL=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
`;
    fs.writeFileSync(envPath, envContent);
    console.log("   ✅ Created .env file with default values");
  }
} else {
  console.log("   ⚠️  .env file already exists");
}

// Install dependencies
console.log("\n📦 Installing dependencies...");
try {
  execSync("npm install", {
    stdio: "inherit",
    cwd: path.join(__dirname, ".."),
  });
  console.log("   ✅ Dependencies installed successfully");
} catch (error) {
  console.error("   ❌ Failed to install dependencies:", error.message);
  process.exit(1);
}

// Build TypeScript
console.log("\n🔨 Building TypeScript...");
try {
  execSync("npm run build", {
    stdio: "inherit",
    cwd: path.join(__dirname, ".."),
  });
  console.log("   ✅ TypeScript build completed");
} catch (error) {
  console.error("   ❌ Failed to build TypeScript:", error.message);
  process.exit(1);
}

console.log("\n🎉 Setup completed successfully!");
console.log("\n📋 Next steps:");
console.log("   1. Make sure MongoDB is running on your system");
console.log("   2. Update the .env file with your configuration");
console.log('   3. Run "npm run dev" to start the development server');
console.log(
  "   4. Visit http://localhost:5000/health to check if the server is running"
);
console.log("\n📚 API Documentation:");
console.log(
  "   - Authentication: POST /api/auth/register, POST /api/auth/login"
);
console.log("   - Subjects: GET /api/subjects, POST /api/subjects (admin)");
console.log("   - Courses: GET /api/courses, POST /api/courses (admin)");
console.log("   - File Upload: POST /api/courses/:id/upload-epub (admin)");
console.log("\n🔐 Default admin user:");
console.log(
  '   You can create an admin user by registering with role: "admin"'
);
console.log('   Or update an existing user\'s role to "admin" in the database');
