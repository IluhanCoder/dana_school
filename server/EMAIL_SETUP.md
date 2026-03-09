# Налаштування Email для скидання пароля

## Для Gmail

1. Увімкніть 2-факторну автентифікацію у вашому Google акаунті
2. Створіть App Password:
   - Перейдіть на https://myaccount.google.com/apppasswords
   - Виберіть "Пошта" та пристрій
   - Скопіюйте згенерований пароль (16 символів)

3. Оновіть `.env` файл у папці `server`:
```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password-here
```

## Для інших провайдерів

### Outlook/Hotmail
```env
EMAIL_HOST=smtp-mail.outlook.com
EMAIL_PORT=587
EMAIL_USER=your-email@outlook.com
EMAIL_PASSWORD=your-password
```

### Yahoo
```env
EMAIL_HOST=smtp.mail.yahoo.com
EMAIL_PORT=465
EMAIL_USER=your-email@yahoo.com
EMAIL_PASSWORD=your-app-password
```

## Тестування

Після налаштування:

1. Імпортуйте учнів через Excel
2. Кожен учень отримає email з посиланням для встановлення пароля
3. Посилання дійсне 24 години
4. Після встановлення пароля, учень може увійти з новим паролем

## Troubleshooting

Якщо листи не надсилаються, перевірте:
- ✅ EMAIL_USER та EMAIL_PASSWORD правильні
- ✅ 2FA увімкнено (для Gmail)
- ✅ App Password створено (для Gmail)
- ✅ Firewall не блокує порт 587
- ✅ Логи сервера (`npm run dev` в папці server)
