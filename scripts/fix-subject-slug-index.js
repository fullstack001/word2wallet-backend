/**
 * Script to fix the subject slug index issue
 * This script removes the problematic slug index and recreates it properly
 */

const mongoose = require("mongoose");

// MongoDB connection
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/word2wallet";

async function fixSubjectSlugIndex() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB");

    const db = mongoose.connection.db;
    const subjectsCollection = db.collection("subjects");

    console.log("Checking current indexes...");
    const indexes = await subjectsCollection.indexes();
    console.log(
      "Current indexes:",
      indexes.map((idx) => idx.name)
    );

    // Check if slug_1 index exists
    const slugIndex = indexes.find((idx) => idx.name === "slug_1");

    if (slugIndex) {
      console.log("Found slug_1 index, removing it...");
      await subjectsCollection.dropIndex("slug_1");
      console.log("Removed slug_1 index");
    } else {
      console.log("No slug_1 index found");
    }

    // Check for any subjects with null slug values
    console.log("Checking for subjects with null slug values...");
    const subjectsWithNullSlug = await subjectsCollection
      .find({ slug: null })
      .toArray();
    console.log(
      `Found ${subjectsWithNullSlug.length} subjects with null slug values`
    );

    // Update subjects with null slug values to have proper slugs
    if (subjectsWithNullSlug.length > 0) {
      console.log("Updating subjects with null slug values...");

      for (const subject of subjectsWithNullSlug) {
        if (subject.name) {
          // Generate slug from name
          const slug = subject.name
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, "") // Remove special characters
            .replace(/\s+/g, "-") // Replace spaces with hyphens
            .replace(/-+/g, "-") // Replace multiple hyphens with single hyphen
            .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens

          await subjectsCollection.updateOne(
            { _id: subject._id },
            { $set: { slug: slug } }
          );
          console.log(`Updated subject "${subject.name}" with slug "${slug}"`);
        }
      }
    }

    // Create the new sparse unique index on slug
    console.log("Creating new sparse unique index on slug...");
    await subjectsCollection.createIndex(
      { slug: 1 },
      {
        unique: true,
        sparse: true,
        name: "slug_1",
      }
    );
    console.log("Created new slug index");

    // Verify the new indexes
    console.log("Verifying new indexes...");
    const newIndexes = await subjectsCollection.indexes();
    console.log(
      "New indexes:",
      newIndexes.map((idx) => idx.name)
    );

    console.log("✅ Subject slug index fix completed successfully!");
  } catch (error) {
    console.error("❌ Error fixing subject slug index:", error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

// Run the script
if (require.main === module) {
  fixSubjectSlugIndex()
    .then(() => {
      console.log("Script completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Script failed:", error);
      process.exit(1);
    });
}

module.exports = { fixSubjectSlugIndex };
