import * as XLSX from "xlsx";
import bcrypt from "bcryptjs";
import userModel from "./user-model";
import { IUser } from "../types/user.types";

interface StudentRow {
  name: string;
  accountNumber: string;
  parentContact: string;
  phone?: string;
  birthdate?: Date;
}

// Helper: normalize header keys for matching
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function findHeaderRowIndex(table: any[][]): number {
  for (let i = 0; i < Math.min(table.length, 12); i++) {
    const cells = (table[i] || []).map((cell) => norm(String(cell || "")));
    const hasName = cells.some((c) => c.includes("піб") || c.includes("ім'я") || c.includes("імя") || c.includes("name"));
    const hasNumber = cells.some((c) => (c.includes("номер") && !c.includes("телефон")) || c.includes("account"));
    const hasParents = cells.some((c) => c.includes("бать") || c.includes("parents"));

    if (hasName && hasNumber && hasParents) {
      return i;
    }
  }

  return 0;
}

function inferColumnIndexes(headerRow: any[]) {
  const headers = (headerRow || []).map((cell) => String(cell || ""));

  const findIndex = (predicate: (n: string) => boolean) => {
    for (let i = 0; i < headers.length; i++) {
      if (predicate(norm(headers[i]))) return i;
    }
    return -1;
  };

  const nameIndex = findIndex((n) => n.includes("піб") || n.includes("ім'я") || n.includes("імя") || n.includes("name"));
  const numberIndex = findIndex((n) => (n.includes("номер") && !n.includes("телефон")) || n.includes("account") || n.includes("орд"));
  const birthdateIndex = findIndex((n) => (n.includes("дата") && n.includes("народ")) || n.includes("birth"));
  const parentsIndex = findIndex((n) => n.includes("бать") || n.includes("parents"));
  const phoneIndex = findIndex((n) => n.includes("телефон") || n.includes("phone"));
  const emailIndex = findIndex((n) => n.includes("email") || n.includes("e-mail") || n.includes("пошта") || n.includes("електрон"));

  return { nameIndex, numberIndex, birthdateIndex, parentsIndex, phoneIndex, emailIndex };
}

function normalizePhone(value: any): string | undefined {
  if (value === undefined || value === null) return undefined;
  const raw = String(value).trim();
  if (!raw) return undefined;
  // Excel often formats big phone numbers with commas - strip separators only.
  return raw.replace(/[\s,]/g, "");
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function createStableDate(year: number, month: number, day: number): Date {
  // Use local noon to avoid timezone-related day shifts when serialized/deserialized.
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function parseBirthdate(value: any): Date | undefined {
  if (value === undefined || value === null || value === "") return undefined;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return createStableDate(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }

  if (typeof value === "number") {
    const decoded = XLSX.SSF.parse_date_code(value);
    if (decoded?.y && decoded?.m && decoded?.d) {
      return createStableDate(decoded.y, decoded.m, decoded.d);
    }
  }

  const source = String(value).trim();
  if (!source) return undefined;

  const slashOrDot = source.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (slashOrDot) {
    const day = Number(slashOrDot[1]);
    const month = Number(slashOrDot[2]);
    let year = Number(slashOrDot[3]);
    if (year < 100) year += 2000;
    const parsed = createStableDate(year, month, day);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const monthMap: Record<string, number> = {
    "січня": 0,
    "лютого": 1,
    "березня": 2,
    "квітня": 3,
    "травня": 4,
    "червня": 5,
    "липня": 6,
    "серпня": 7,
    "вересня": 8,
    "жовтня": 9,
    "листопада": 10,
    "грудня": 11,
  };

  const textDate = source.toLowerCase().match(/^(\d{1,2})\s+([а-яіїєґ']+)\s+(\d{4})$/i);
  if (textDate) {
    const day = Number(textDate[1]);
    const monthName = textDate[2];
    const year = Number(textDate[3]);
    const monthIndex = monthMap[monthName];
    if (monthIndex !== undefined) {
      const parsed = createStableDate(year, monthIndex + 1, day);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
  }

  const fallback = new Date(source);
  if (!Number.isNaN(fallback.getTime())) {
    return createStableDate(fallback.getFullYear(), fallback.getMonth() + 1, fallback.getDate());
  }

  return undefined;
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

    const table = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "", raw: true });

    if (table.length === 0) {
      throw new Error("У таблиці не знайдено даних");
    }

    const headerRowIndex = findHeaderRowIndex(table);
    const headerRow = table[headerRowIndex] || [];
    const dataRows = table.slice(headerRowIndex + 1);

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    const { nameIndex, numberIndex, birthdateIndex, parentsIndex, phoneIndex, emailIndex } = inferColumnIndexes(headerRow);

    // Validate required column mappings
    const missing: string[] = [];
    if (nameIndex < 0) missing.push("піб (name)");
    if (numberIndex < 0) missing.push("номер (account number)");
    if (parentsIndex < 0) missing.push("батьки (parent contact)");
    if (missing.length) {
      throw new Error(
        `Не знайдено обов'язкових колонок (без урахування регістру): ${missing.join(", ")}`
      );
    }

    for (const row of dataRows) {
      try {
        const name = (row[nameIndex] ?? "").toString().trim();
        const accountNumberRaw = row[numberIndex];
        const parentContact = (row[parentsIndex] ?? "").toString().trim();
        const phone = phoneIndex >= 0 ? normalizePhone(row[phoneIndex]) : undefined;
        const providedEmail = emailIndex >= 0 ? (row[emailIndex] ?? "").toString().trim().toLowerCase() : "";
        const birthdateRaw = birthdateIndex >= 0 ? row[birthdateIndex] : undefined;
        const birthdate = parseBirthdate(birthdateRaw);

        // Skip empty trailing rows.
        if (!name && !parentContact && (accountNumberRaw === "" || accountNumberRaw === undefined || accountNumberRaw === null)) {
          continue;
        }

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

        if (birthdateRaw !== undefined && birthdateRaw !== null && `${birthdateRaw}`.trim() !== "" && !birthdate) {
          errors.push(`Рядок для "${name}" пропущено: невалідна дата народження`);
          skipped++;
          continue;
        }

        // Email may be absent for imported users. Admin can fill it later from dashboard.
        const email = providedEmail && providedEmail.length > 0 ? providedEmail : undefined;

        if (email && !isValidEmail(email)) {
          errors.push(`Рядок для "${name}" пропущено: невалідний email`);
          skipped++;
          continue;
        }

        // Check if user already exists (by name and parentContact)
        const existingUser = await userModel.findOne({
          name,
          parentContact,
        });

        if (existingUser) {
          errors.push(`Користувач "${name}" з контактом батьків "${parentContact}" вже існує`);
          skipped++;
          continue;
        }

        // Check if email exists
        if (email) {
          const existingByEmail = await userModel.findOne({ email });
          if (existingByEmail) {
            errors.push(`Email "${email}" вже існує`);
            skipped++;
            continue;
          }
        }

        // Hash password
        const hashedPassword = await bcrypt.hash("danaschool", 10);

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
          birthdate,
        };
        
        console.log(`[Import] Creating student ${name} with grade=${grade}:`, { name, email, grade });

        await userModel.create(newUser);
        created++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push(`Помилка обробки "${(row[nameIndex] ?? "").toString().trim()}": ${errorMessage}`);
      }
    }

    return { created, skipped, errors };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Не вдалося імпортувати учнів: ${errorMessage}`);
  }
}
