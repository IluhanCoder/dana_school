import nodemailer from "nodemailer";

// Create transporter for sending emails
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp.gmail.com",
  port: parseInt(process.env.EMAIL_PORT || "587"),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

export async function sendPasswordResetEmail(
  email: string,
  name: string,
  resetToken: string
): Promise<void> {
  const resetUrl = `${process.env.CLIENT_URL || "http://localhost:5173"}/reset-password/${resetToken}`;

  const mailOptions = {
    from: `"Dana School" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Встановлення пароля - Dana School",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Вітаємо, ${name}!</h2>
        <p>Ваш обліковий запис у Dana School було створено.</p>
        <p>Для початку роботи встановіть свій особистий пароль:</p>
        <div style="margin: 30px 0;">
          <a href="${resetUrl}" 
             style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Встановити пароль
          </a>
        </div>
        <p style="color: #666; font-size: 14px;">
          Якщо кнопка не працює, скопіюйте це посилання у браузер:<br>
          <a href="${resetUrl}" style="color: #2563eb;">${resetUrl}</a>
        </p>
        <p style="color: #666; font-size: 14px;">
          Це посилання дійсне протягом 24 годин.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #999; font-size: 12px;">
          Якщо ви не реєструвалися у Dana School, проігноруйте цей лист.
        </p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Password reset email sent to ${email}`);
  } catch (error) {
    console.error(`Failed to send email to ${email}:`, error);
    throw new Error(`Failed to send password reset email`);
  }
}

export default {
  sendPasswordResetEmail,
};
