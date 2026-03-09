import "dotenv/config";
import mongoose from "mongoose";
import userService from "../src/user/user-service";

async function main() {
  const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/school_app";

  await mongoose.connect(MONGO_URI);

  const adminEmail = process.env.ADMIN_EMAIL || "admin"; // code word login
  const adminPassword = process.env.ADMIN_PASSWORD || "school321"; // requested password
  const adminName = process.env.ADMIN_NAME || "School Admin";

  const existing = await userService.getUserByEmail(adminEmail);
  if (existing) {
    console.log(`Admin already exists: ${adminEmail}`);
    await mongoose.disconnect();
    return;
  }

  await userService.createUser(adminName, adminEmail, adminPassword, "admin");
  console.log(`Admin created: ${adminEmail} / password: ${adminPassword}`);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("Failed to create admin:", err);
  await mongoose.disconnect();
  process.exit(1);
});
