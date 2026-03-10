import "dotenv/config";
import mongoose from "mongoose";
import userModel from "../src/user/user-model";

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDateBetween(start: Date, end: Date): Date {
  const min = start.getTime();
  const max = end.getTime();
  const timestamp = randomInt(min, max);
  return new Date(timestamp);
}

function generateStudentBirthdate(grade?: number): Date {
  const now = new Date();
  const currentYear = now.getFullYear();

  const safeGrade = typeof grade === "number" && grade >= 0 && grade <= 11 ? grade : 5;
  const expectedAge = 6 + safeGrade;

  const youngest = new Date(currentYear - expectedAge, 11, 31);
  const oldest = new Date(currentYear - expectedAge - 1, 0, 1);
  return randomDateBetween(oldest, youngest);
}

function generateAdultBirthdate(): Date {
  const now = new Date();
  const currentYear = now.getFullYear();
  const youngest = new Date(currentYear - 24, 11, 31);
  const oldest = new Date(currentYear - 60, 0, 1);
  return randomDateBetween(oldest, youngest);
}

async function main() {
  const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/school_app";
  await mongoose.connect(MONGO_URI);

  const users = await userModel.find({});
  let copiedFromLegacy = 0;
  let generated = 0;

  for (const user of users) {
    const existingBirthdate = (user as any).birthdate;
    if (existingBirthdate) {
      continue;
    }

    const legacyBirthdate = (user as any).dateOfBirth;
    if (legacyBirthdate) {
      (user as any).birthdate = legacyBirthdate;
      await user.save();
      copiedFromLegacy += 1;
      continue;
    }

    const nextBirthdate =
      user.role === "student"
        ? generateStudentBirthdate((user as any).grade)
        : generateAdultBirthdate();

    (user as any).birthdate = nextBirthdate;
    await user.save();
    generated += 1;
  }

  console.log(`Birthdate seed complete. Copied from legacy: ${copiedFromLegacy}, generated: ${generated}`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("Birthdate seed failed:", error);
  await mongoose.disconnect();
  process.exit(1);
});
