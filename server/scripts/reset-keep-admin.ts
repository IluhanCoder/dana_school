import "dotenv/config";
import mongoose from "mongoose";
import userModel from "../src/user/user-model";
import userService from "../src/user/user-service";
import registrationRequestModel from "../src/auth/registration-request-model";
import subjectModel from "../src/subject/subject-model";
import journalModel from "../src/journal/journal-model";
import attendanceModel from "../src/attendance/attendance-model";
import { ClassModel } from "../src/class/class-model";
import { GradeModel } from "../src/grade/grade-model";
import explanationCacheModel from "../src/generation/explanation-cache-model";

async function ensureAdminUser() {
  const adminEmail = process.env.ADMIN_EMAIL || "admin";
  const adminPassword = process.env.ADMIN_PASSWORD || "school321";
  const adminName = process.env.ADMIN_NAME || "School Admin";

  let admin = await userModel.findOne({ email: adminEmail, role: "admin" });
  if (!admin) {
    admin = await userModel.findOne({ role: "admin" });
  }

  if (!admin) {
    const created = await userService.createUser(adminName, adminEmail, adminPassword, "admin");
    admin = await userModel.findById(created._id);
    if (!admin) {
      throw new Error("Не вдалося створити admin користувача");
    }
    console.log(`Створено admin користувача: ${adminEmail}`);
  }

  await userModel.updateOne(
    { _id: admin._id },
    {
      $set: {
        role: "admin",
        isArchived: false,
        archivedAt: null,
        grade: null,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    }
  );

  return admin._id;
}

async function main() {
  const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/school_app";

  await mongoose.connect(mongoUri);
  console.log("Підключено до MongoDB");

  const adminId = await ensureAdminUser();

  const [
    deletedRequests,
    deletedSubjects,
    deletedJournals,
    deletedAttendance,
    deletedClasses,
    deletedGrades,
    deletedCache,
    deletedUsers,
  ] = await Promise.all([
    registrationRequestModel.deleteMany({}),
    subjectModel.deleteMany({}),
    journalModel.deleteMany({}),
    attendanceModel.deleteMany({}),
    ClassModel.deleteMany({}),
    GradeModel.deleteMany({}),
    explanationCacheModel.deleteMany({}),
    userModel.deleteMany({ _id: { $ne: adminId } }),
  ]);

  const totalUsers = await userModel.countDocuments({});

  console.log("Очищення завершено:");
  console.log(`- registration requests: ${deletedRequests.deletedCount}`);
  console.log(`- subjects: ${deletedSubjects.deletedCount}`);
  console.log(`- journals: ${deletedJournals.deletedCount}`);
  console.log(`- attendance records: ${deletedAttendance.deletedCount}`);
  console.log(`- classes: ${deletedClasses.deletedCount}`);
  console.log(`- grades: ${deletedGrades.deletedCount}`);
  console.log(`- explanation cache: ${deletedCache.deletedCount}`);
  console.log(`- users deleted: ${deletedUsers.deletedCount}`);
  console.log(`- users left: ${totalUsers} (повинен бути 1 admin)`);

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("Помилка reset-скрипта:", error);
  await mongoose.disconnect();
  process.exit(1);
});
