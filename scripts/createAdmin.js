import mongoose from "mongoose";
import { config } from "dotenv";
import { connectDB } from "../src/config/database";
import { User } from "../src/models/User";
import { UserRole } from "../src/types";

// Load environment variables
config();

async function createAdminUser() {
  try {
    // Connect to MongoDB using the same configuration as the main app
    await connectDB();
    console.log("✅ Connected to MongoDB using main app configuration");

    // Check if admin user already exists
    const existingAdmin = await User.findOne({ role: UserRole.ADMIN });

    if (existingAdmin) {
      console.log("ℹ️  Admin user already exists:", existingAdmin.email);
      console.log("👤 Name:", existingAdmin.fullName);
      process.exit(0);
    }

    // Get admin data from command line arguments or environment variables
    const email =
      process.argv[2] || process.env.ADMIN_EMAIL || "admin@word2wallet.com";
    const password =
      process.argv[3] || process.env.ADMIN_PASSWORD || "admin123456";
    const firstName =
      process.argv[4] || process.env.ADMIN_FIRST_NAME || "Admin";
    const lastName = process.argv[5] || process.env.ADMIN_LAST_NAME || "User";

    // Validate inputs
    if (!email || !password || !firstName || !lastName) {
      console.error("❌ Missing required fields. Usage:");
      console.error(
        "npm run create-admin <email> <password> <firstName> <lastName>"
      );
      console.error(
        "Or set environment variables: ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_FIRST_NAME, ADMIN_LAST_NAME"
      );
      process.exit(1);
    }

    if (password.length < 6) {
      console.error("❌ Password must be at least 6 characters long");
      process.exit(1);
    }

    // Create admin user using the same User model as the main app
    const adminUser = new User({
      email: email.toLowerCase(),
      password: password,
      firstName: firstName,
      lastName: lastName,
      role: UserRole.ADMIN,
      isActive: true,
    });

    await adminUser.save();

    console.log("🎉 Admin user created successfully!");
    console.log(`📧 Email: ${adminUser.email}`);
    console.log(`👤 Name: ${adminUser.fullName}`);
    console.log(`🔑 Role: ${adminUser.role}`);
    console.log("⚠️  Please change the default password after first login!");
  } catch (error) {
    if (error && error.code === 11000) {
      console.log("ℹ️  Admin user with this email already exists");
    } else {
      console.error(
        "❌ Failed to create admin user:",
        error && error.message ? error.message : error
      );
    }
  } finally {
    await mongoose.disconnect();
    console.log("📡 Disconnected from MongoDB");
    process.exit(0);
  }
}

// Run the script
createAdminUser();
