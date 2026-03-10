import * as XLSX from "xlsx";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import userModel from "./user-model";
import { IUser } from "../types/user.types";
import { sendPasswordResetEmail } from "../services/email-service";

interface StudentRow {
  name: string;
  accountNumber: string;
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
  const parentsKey = find((_, n) => n.includes("бать") || n.includes("батьки") || n.includes("parents"));
  const phoneKey = find((_, n) => n.includes("телефон") || n.includes("phone"));
  // Email detection: be precise - look for "email" or Ukrainian variants, but avoid false positives
  const emailKey = find((_, n) => 
    n.includes("email") || 
    n.includes("пошта") || 
    n.includes("електрон") ||
    (n.includes("e-mail"))
  );

  return { nameKey, numberKey, parentsKey, phoneKey, emailKey };
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
      throw new Error("У файлі не знайдено аркуша");
    }

    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "", raw: false });
    
    if (rows.length === 0) {
      throw new Error("У таблиці не знайдено даних");
    }

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Infer columns from headers (case-insensitive, includes matching)
    const { nameKey, numberKey, parentsKey, phoneKey, emailKey } = inferColumnMap(rows);

    // Validate required column mappings
    const missing: string[] = [];
    if (!nameKey) missing.push("піб (name)");
    if (!numberKey) missing.push("номер (account number)");
    if (!parentsKey) missing.push("батьки (parent contact)");
    if (missing.length) {
      throw new Error(
        `Не знайдено обов'язкових колонок (без урахування регістру): ${missing.join(", ")}`
      );
    }

    for (const row of rows) {
      try {
        // Extract values using inferred keys
        const name = (row[nameKey!] ?? "").toString().trim();
        const accountNumberRaw = row[numberKey!];
        const parentContact = (row[parentsKey!] ?? "").toString().trim();
        const phone = phoneKey ? (row[phoneKey] ?? "").toString().trim() : undefined;
        const providedEmail = emailKey ? (row[emailKey] ?? "").toString().trim().toLowerCase() : "";

        // Validate required fields
        if (!name || !parentContact) {
          errors.push(`Рядок пропущено: відсутнє ім'я або контакт батьків`);
          skipped++;
          continue;
        }
        if (accountNumberRaw === undefined || accountNumberRaw === null || `${accountNumberRaw}`.trim() === "") {
          errors.push(`Рядок пропущено: відсутній номер особової справи (номер)`);
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
          errors.push(`Користувач "${row.name}" з контактом батьків "${row.parentContact}" вже існує`);
          skipped++;
          continue;
        }

        // Check if email exists
        const existingByEmail = await userModel.findOne({ email });
        if (existingByEmail) {
          errors.push(`Email "${email}" вже існує`);
          skipped++;
          continue;
        }

        // Hash password
        const hashedPassword = await bcrypt.hash("123456", 10);

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
          console.error(`[Import] Не вдалося надіслати email на ${email}:`, emailError);
          errors.push(`Користувача "${name}" створено, але не вдалося надіслати email`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push(`Помилка обробки "${(row[nameKey!] ?? "").toString().trim()}": ${errorMessage}`);
      }
    }

    return { created, skipped, errors };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Не вдалося імпортувати учнів: ${errorMessage}`);
  }
}
