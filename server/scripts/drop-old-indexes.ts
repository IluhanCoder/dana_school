import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../.env") });

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/school_app";

async function dropOldIndexes() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✓ Connected to MongoDB");

    const db = mongoose.connection.db;
    const collection = db?.collection("journals");

    if (!collection) {
      throw new Error("Failed to get journals collection");
    }

    console.log("\nCurrent indexes:");
    const indexes = await collection.indexes();
    indexes.forEach((idx: any) => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
    });

    // Drop old index if exists
    try {
      await collection.dropIndex("subject_1_class_1");
      console.log("\n✓ Dropped old index: subject_1_class_1");
    } catch (err: any) {
      if (err.code === 27 || err.codeName === "IndexNotFound") {
        console.log("\n• Old index not found (already dropped or never existed)");
      } else {
        throw err;
      }
    }

    console.log("\nIndexes after cleanup:");
    const newIndexes = await collection.indexes();
    newIndexes.forEach((idx: any) => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
    });

    console.log("\n✓ Done!");
  } catch (error) {
    console.error("✗ Error:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

dropOldIndexes();
