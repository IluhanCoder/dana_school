import * as XLSX from "xlsx";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import userModel from "./user-model";
import { IUser } from "../types/user.types";
import { sendPasswordResetEmail } from "../services/email-service";

interface StudentRow {
  name: string;
  accountNumber: string;
  dateOfBirth: string | Date;
  parentContact: string;
  phone: string;
}

// Helper: normalize header keys for matching
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Infer column keys from headers with case-insensitive, substring matching
function inferColumnMap(rows: Array<Record<string, any>>) {
  const headerSet = new Set<string>();
  for (const row of rows.slice(0, 5)) {
    Object.keys(row).forEach((k) => headerSet.add(k));
  }
  const headers = Array.from(headerSet);

  const find = (predicate: (key: string, n: string) => boolean) => {
    for (const h of headers) {
      const n = norm(h);
      if (predicate(h, n)) return h;
    }
    return undefined;
  };

  // Match patterns (Ukrainian keywords, with sensible fallbacks)
  const nameKey = find((_, n) => n.includes("піб") || n.includes("ім'я") || n.includes("імя") || n.includes("name"));
  // Account number: include "номер" but avoid phone column (which often also contains "номер")
  const numberKey = find((_, n) => (n.includes("номер") && !n.includes("телефон")) || n.includes("account"));
  const dobKey = find((_, n) => (n.includes("дата") && (n.includes("народ") || n.includes("народжен"))) || n.includes("birth"));
  const parentsKey = find((_, n) => n.includes("бать") || n.includes("батьки") || n.includes("parents"));
  const phoneKey = find((_, n) => n.includes("телефон") || n.includes("phone"));
  // Email detection: be precise - look for "email" or Ukrainian variants, but avoid false positives
  const emailKey = find((_, n) => 
    n.includes("email") || 
    n.includes("пошта") || 
    n.includes("електрон") ||
    (n.includes("e-mail"))
  );

  return { nameKey, numberKey, dobKey, parentsKey, phoneKey, emailKey };
}

export async function importStudentsFromExcel(fileBuffer: Buffer, grade?: number): Promise<{
  created: number;
  skipped: number;
  errors: string[];
}> {
  try {
    console.log(`[Import] Starting import with grade=${grade}, type=${typeof grade}`);
    const workbook = XLSX.read(fileBuffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    
    if (!sheet) {
      throw new Error("No worksheet found in the file");
    }

    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "", raw: false });
    
    if (rows.length === 0) {
      throw new Error("No data found in the spreadsheet");
    }

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Infer columns from headers (case-insensitive, includes matching)
    const { nameKey, numberKey, dobKey, parentsKey, phoneKey, emailKey } = inferColumnMap(rows);

    // Validate required column mappings
    const missing: string[] = [];
    if (!nameKey) missing.push("піб (name)");
    if (!numberKey) missing.push("номер (account number)");
    if (!parentsKey) missing.push("батьки (parent contact)");
    if (missing.length) {
      throw new Error(
        `Required columns not found (case-insensitive, includes): ${missing.join(", ")}`
      );
    }

    for (const row of rows) {
      try {
        // Extract values using inferred keys
        const name = (row[nameKey!] ?? "").toString().trim();
        const accountNumberRaw = row[numberKey!];
        const parentContact = (row[parentsKey!] ?? "").toString().trim();
        const phone = phoneKey ? (row[phoneKey] ?? "").toString().trim() : undefined;
        const dobVal = dobKey ? row[dobKey] : undefined;
        const providedEmail = emailKey ? (row[emailKey] ?? "").toString().trim().toLowerCase() : "";

        // Validate required fields
        if (!name || !parentContact) {
          errors.push(`Row skipped: Missing name or parent contact`);
          skipped++;
          continue;
        }
        if (accountNumberRaw === undefined || accountNumberRaw === null || `${accountNumberRaw}`.trim() === "") {
          errors.push(`Row skipped: Missing account number (номер)`);
          skipped++;
          continue;
        }

        // Generate email from name and account number, or use provided email from Excel
        let email: string;
        if (providedEmail && providedEmail.length > 0) {
          // Use email from Excel file if provided
          email = providedEmail;
        } else {
          // Fall back to generating email from name and account number
          const emailBase = name.toLowerCase().replace(/\s+/g, ".") + "." + `${accountNumberRaw}`.toString().trim();
          email = `${emailBase}@dana.school`;
        }

        // Check if user already exists (by name and parentContact)
        const existingUser = await userModel.findOne({
          name,
          parentContact,
        });

        if (existingUser) {
          errors.push(`User "${row.name}" with parent contact "${row.parentContact}" already exists`);
          skipped++;
          continue;
        }

        // Check if email exists
        const existingByEmail = await userModel.findOne({ email });
        if (existingByEmail) {
          errors.push(`Email "${email}" already exists`);
          skipped++;
          continue;
        }

        // Hash password
        const hashedPassword = await bcrypt.hash("123456", 10);

        // Parse date of birth
        let dateOfBirth: Date | undefined;
        if (dobVal !== undefined && dobVal !== null && `${dobVal}`.trim() !== "") {
          const parsed = parseExcelDate(dobVal as any);
          dateOfBirth = parsed;
        }

        // Generate password reset token (valid for 24 hours)
        const resetToken = crypto.randomBytes(32).toString("hex");
        const resetExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

        // Create new user
        const newUser: IUser = {
          name: name,
          email,
          password: hashedPassword,
          role: "student",
          grade: grade, // Assign selected grade to all imported students
          accountNumber: `${accountNumberRaw}`.toString().trim(),
          dateOfBirth,
          parentContact,
          phone,
          passwordResetToken: resetToken,
          passwordResetExpires: resetExpires,
        };
        
        console.log(`[Import] Creating student ${name} with grade=${grade}:`, { name, email, grade });

        const createdUser = await userModel.create(newUser);
        created++;

        // Send password reset email (don't fail import if email fails)
        try {
          await sendPasswordResetEmail(email, name, resetToken);
          console.log(`[Import] Password reset email sent to ${email}`);
        } catch (emailError) {
          console.error(`[Import] Failed to send email to ${email}:`, emailError);
          errors.push(`User "${name}" created but email failed to send`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push(`Error processing "${(row[nameKey!] ?? "").toString().trim()}": ${errorMessage}`);
      }
    }

    return { created, skipped, errors };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to import students: ${errorMessage}`);
  }
}

// Helper to parse Excel date (which comes as number)
function parseExcelDate(value: string | Date | number): Date | undefined {
  if (!value) return undefined;

  // If it's already a Date
  if (value instanceof Date) {
    return value;
  }

  // If it's a string
  if (typeof value === "string") {
    const s = value.trim();
    // Handle DD.MM.YYYY format explicitly
    const dmY = /^([0-3]?\d)\.([0-1]?\d)\.(\d{4})$/;
    const m = dmY.exec(s);
    if (m) {
      const day = parseInt(m[1], 10);
      const month = parseInt(m[2], 10) - 1; // JS months 0-11
      const year = parseInt(m[3], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d;
    }
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
    return undefined;
  }

  // If it's a number (Excel serial date)
  if (typeof value === "number") {
    // Excel stores dates as days since Dec 30, 1899
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + value * 86400000);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  return undefined;
}
