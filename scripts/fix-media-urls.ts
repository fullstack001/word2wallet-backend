import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../.env") });

// Import Media model
import { Media } from "../src/models/Media";

async function fixMediaUrls() {
  try {
    // Connect to MongoDB
    const mongoUri =
      process.env.MONGODB_URI || "mongodb://localhost:27017/word2wallet";
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB");

    // Find all media with old /uploads/ URLs
    const mediaWithOldUrls = await Media.find({
      publicUrl: { $regex: /\/files\// },
    });

    console.log(`Found ${mediaWithOldUrls.length} media items with old URLs`);

    // Update each media item
    for (const item of mediaWithOldUrls) {
      const newUrl = item.publicUrl.replace("/files/", "/uploads/");
      await Media.findByIdAndUpdate(item._id, { publicUrl: newUrl });
      console.log(`✅ Updated: ${item.title} -> ${newUrl}`);
    }

    console.log(
      `\n🎉 Successfully updated ${mediaWithOldUrls.length} media URLs`
    );

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error fixing media URLs:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the migration
fixMediaUrls();
