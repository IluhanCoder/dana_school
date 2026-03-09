# Google Cloud Storage Setup (PDF Materials)

Ця інструкція налаштовує завантаження PDF матеріалів для предметів у Google Cloud Storage.

## 1) Створити GCP Project

1. Відкрийте Google Cloud Console: https://console.cloud.google.com
2. Створіть новий project (або використайте існуючий).
3. Запишіть `PROJECT_ID`.

## 2) Увімкнути API

У Project увімкніть:
- **Cloud Storage API**

## 3) Створити Bucket

1. Перейдіть у **Cloud Storage → Buckets**.
2. Натисніть **Create bucket**.
3. Назва, наприклад: `school-project-materials-prod`.
4. Region: оберіть найближчий до вашого серверу.
5. Storage class: `Standard`.
6. Access control: залиште за замовчуванням (private).

> Система використовує signed URL, тому bucket може залишатися приватним.

## 4) Створити Service Account

1. IAM & Admin → **Service Accounts** → Create.
2. Назва: `school-materials-uploader`.
3. Дайте роль:
   - `Storage Object Admin` (мінімально для upload/read/delete об’єктів)
4. Створіть JSON key:
   - Service Account → Keys → Add key → Create new key → JSON.
5. Збережіть файл ключа безпечно.

## 5) Підключення до backend

У `server/.env` додайте:

```dotenv
GCS_PROJECT_ID=your-gcp-project-id
GCS_BUCKET_NAME=your-bucket-name
```

### Варіант A (рекомендовано локально): через файл ключа

```dotenv
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json
```

### Варіант B (для deploy-платформ): inline credentials

```dotenv
GCS_CLIENT_EMAIL=service-account@your-project.iam.gserviceaccount.com
GCS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

> Якщо використовуєте `GCS_PRIVATE_KEY`, `\n` має бути саме в такому escaped форматі.

## 6) Запустити backend

```bash
cd server
npm run build
npm run dev
```

## 7) Як перевірити в UI

1. Увійдіть як викладач предмета або адміністратор.
2. Відкрийте предмет.
3. Натисніть **Матеріали PDF**.
4. Завантажте файл `.pdf`.
5. Перевірте, що файл з’явився в таблиці та відкривається через посилання.

## API (додано)

- `GET /api/subjects/:id/materials`
  - Повертає список PDF матеріалів предмету
  - Доступ: `admin` або викладач цього предмету

- `POST /api/subjects/:id/materials` (multipart/form-data)
  - Поле: `file`
  - Приймає тільки `application/pdf`
  - Доступ: `admin` або викладач цього предмету

## Обмеження

- Максимальний розмір файлу: **20 MB**
- MIME type: **application/pdf**

## Troubleshooting

### `GCS is not configured: GCS_BUCKET_NAME is required`
- Перевірте, що в `server/.env` є `GCS_BUCKET_NAME`.

### `Could not load the default credentials`
- Для Варіанту A: перевірте `GOOGLE_APPLICATION_CREDENTIALS` і шлях до JSON.
- Для Варіанту B: перевірте `GCS_CLIENT_EMAIL` і `GCS_PRIVATE_KEY`.

### `Forbidden`
- Викладач може працювати тільки зі своїм предметом.
- Адміністратор має доступ до всіх предметів.

### Не відкривається PDF URL
- Переконайтесь, що service account має права на bucket.
- Перевірте, що upload завершився без помилок у backend логах.

## Security Notes

- Не комітьте JSON ключі в git.
- Для production краще зберігати секрети в Secret Manager / environment secrets.
- Якщо потрібно, можна ротацію service account keys робити регулярно.
