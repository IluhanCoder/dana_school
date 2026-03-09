# Student Excel Import - Quick Reference

## ⚡ Quick Start Testing

### 1️⃣ Start Services (2 Terminals)

**Terminal 1 - Server:**
```bash
cd /Users/Elijah/Documents/school_project/server
npm run dev
```

**Terminal 2 - Client:**
```bash
cd /Users/Elijah/Documents/school_project/client
npm run dev
```

### 2️⃣ Access Application
- Open: http://localhost:5173
- Login with admin credentials

### 3️⃣ Create Test Data
Create Excel file (`test_data.xlsx`) with headers:
- ПІБ (Full Name)
- номер зліватки (Account Number)
- дата народження (Birth Date, format: YYYY-MM-DD)
- контакт батька (Parent Contact)
- номер телефону (Phone Number)

Example row:
```
Іванов Іван Іванович | 12001 | 2008-05-15 | +380671234567 | 0671234567
```

### 4️⃣ Import
1. Go to Dashboard
2. Click "Імпортувати учнів" button
3. Upload Excel file
4. View results

## 📁 Key Files

| File | Type | Purpose |
|------|------|---------|
| `/server/src/user/user-import.service.ts` | NEW | Excel parsing & import logic |
| `/client/src/components/StudentImportModal.tsx` | NEW | Import UI modal |
| `/server/src/user/user-router.ts` | MODIFIED | API endpoint |
| `/server/src/user/user-model.ts` | MODIFIED | Database schema |
| `/client/src/user/dashboard-page.tsx` | MODIFIED | Dashboard integration |

## 🔧 Technologies Used

- **Excel**: XLSX library (xlsx@^0.18.5)
- **File Upload**: multer@^1.4.5-lts.1
- **Password**: bcryptjs hashing
- **Authentication**: Admin-only access

## 📊 What Gets Imported

Per student:
- Email: `{name}.{accountNumber}@dana.school`
- Password: "123456" (hashed)
- Fields: accountNumber, dateOfBirth, parentContact, phone
- Role: "student"

## ✅ Verification Checklist

- [ ] Server starts without errors
- [ ] Client loads at localhost:5173
- [ ] Can login as admin
- [ ] Dashboard loads
- [ ] "Імпортувати учнів" button visible
- [ ] Can select Excel file
- [ ] Import processes file
- [ ] Results show created count
- [ ] New students appear in dashboard
- [ ] User list refreshes automatically

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| Module not found | Run `npm install` in server directory |
| Type errors | Run `npm install --save-dev @types/multer` |
| File won't upload | Check: admin logged in, file is .xlsx, file exists |
| Dates not parsing | Use format: YYYY-MM-DD |
| Email already exists | Check for duplicates in Excel or database |

## 🎯 Expected Results

**Successful Import:**
- Modal shows: "Successfully imported X students"
- Created count increments
- User list updates
- Modal auto-closes after 1.5s

**With Errors:**
- Shows error count
- Lists problems per row
- Successful imports still complete
- Modal stays open for review

## 📝 Notes

- File upload is memory-based (no disk writes)
- Emails must be unique in system
- Duplicate detection by: name + parentContact
- Support languages: Ukrainian (Cyrillic) characters
- Max file size: ~10MB (system dependent)

---

**Status**: ✅ READY FOR TESTING

All code written, dependencies installed, TypeScript compiled successfully.
