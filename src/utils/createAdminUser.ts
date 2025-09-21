import { User } from "../models/User";
import { UserRole } from "../types";

interface AdminUserData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

/**
 * Creates an admin user if one doesn't already exist
 */
export const createAdminUser = async (
  adminData?: AdminUserData
): Promise<void> => {
  try {
    // Check if admin user already exists
    const existingAdmin = await User.findOne({ role: UserRole.ADMIN });

    if (existingAdmin) {
      console.log("✅ Admin user already exists:", existingAdmin.email);
      return;
    }

    // Default admin credentials (can be overridden by environment variables)
    const defaultAdminData: AdminUserData = {
      email: process.env.ADMIN_EMAIL || "admin@word2wallet.com",
      password: process.env.ADMIN_PASSWORD || "admin123456",
      firstName: process.env.ADMIN_FIRST_NAME || "Admin",
      lastName: process.env.ADMIN_LAST_NAME || "User",
    };

    // Use provided data or defaults
    const adminUserData = adminData || defaultAdminData;

    // Validate required fields
    if (
      !adminUserData.email ||
      !adminUserData.password ||
      !adminUserData.firstName ||
      !adminUserData.lastName
    ) {
      throw new Error(
        "Admin user data is incomplete. Please provide email, password, firstName, and lastName."
      );
    }

    // Validate password strength
    if (adminUserData.password.length < 6) {
      throw new Error("Admin password must be at least 6 characters long.");
    }

    // Create admin user
    const adminUser = new User({
      email: adminUserData.email,
      password: adminUserData.password, // Will be hashed by the pre-save middleware
      firstName: adminUserData.firstName,
      lastName: adminUserData.lastName,
      role: UserRole.ADMIN,
      isActive: true,
    });

    await adminUser.save();

    console.log("🎉 Admin user created successfully!");
    console.log(`📧 Email: ${adminUser.email}`);
    console.log(`👤 Name: ${adminUser.fullName}`);
    console.log(`🔑 Role: ${adminUser.role}`);
    console.log("⚠️  Please change the default password after first login!");
  } catch (error: any) {
    if (error.code === 11000) {
      // Duplicate key error (email already exists)
      console.log("ℹ️  Admin user with this email already exists");
    } else {
      console.error("❌ Failed to create admin user:", error.message);
      throw error;
    }
  }
};

/**
 * Creates admin user with custom data
 */
export const createCustomAdminUser = async (
  adminData: AdminUserData
): Promise<void> => {
  await createAdminUser(adminData);
};

/**
 * Creates admin user with environment variables
 */
export const createAdminUserFromEnv = async (): Promise<void> => {
  await createAdminUser();
};
