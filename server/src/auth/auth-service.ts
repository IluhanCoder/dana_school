import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import userService from "../user/user-service";
import userModel from "../user/user-model";
import registrationRequestModel from "./registration-request-model";
import { IAuthResponse, IAuthRequest, IDecodedToken } from "../types/auth.types";
import { UserRole } from "../types/user.types";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "your-refresh-secret-key";

export default new class AuthService {
  private normalizeBirthdate(value?: string | Date | null): Date | undefined {
    if (!value) return undefined;
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error("Невалідний формат дати народження");
    }

    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (parsed > today) {
      throw new Error("Дата народження не може бути в майбутньому");
    }

    const oldestAllowed = new Date();
    oldestAllowed.setFullYear(oldestAllowed.getFullYear() - 100);
    oldestAllowed.setHours(0, 0, 0, 0);
    if (parsed < oldestAllowed) {
      throw new Error("Дата народження не може бути старшою за 100 років");
    }

    return parsed;
  }

  async registerRequest(
    name: string,
    email: string,
    password: string,
    requestedRole: UserRole = "student",
    birthdate?: string | Date
  ): Promise<{ message: string }> {
    const existingUser = await userService.getUserByEmail(email);
    if (existingUser) {
      throw new Error("Користувач з таким email вже існує");
    }

    const existingRequest = await registrationRequestModel.findOne({ email });
    if (existingRequest) {
      throw new Error("Запит на реєстрацію для цього email вже подано");
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await registrationRequestModel.create({
      name,
      email,
      passwordHash,
      requestedRole,
      birthdate: this.normalizeBirthdate(birthdate),
    });
    return { message: "Запит на реєстрацію подано та очікує схвалення адміністратора" };
  }

  async login(email: string, password: string): Promise<IAuthResponse> {
    // Find user by email
    const user = await userService.getUserByEmail(email);
    if (!user) {
      throw new Error("Невірний email або пароль");
    }
    if ((user as any).isArchived) {
      throw new Error("Обліковий запис в архіві");
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new Error("Невірний email або пароль");
    }

    // Generate tokens
    const accessToken = jwt.sign({ id: user._id, email: user.email, role: user.role }, JWT_SECRET, {
      expiresIn: "15m",
    });

    const refreshToken = jwt.sign({ id: user._id, email: user.email, role: user.role }, JWT_REFRESH_SECRET, {
      expiresIn: "7d",
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user._id?.toString() || "",
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string }> {
    try {
      const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as IDecodedToken;

      const accessToken = jwt.sign({ id: decoded.id, email: decoded.email, role: decoded.role }, JWT_SECRET, {
        expiresIn: "15m",
      });

      return { accessToken };
    } catch (error) {
      throw new Error("Невалідний refresh токен");
    }
  }

  verifyToken(token: string): IDecodedToken {
    try {
      return jwt.verify(token, JWT_SECRET) as IDecodedToken;
    } catch (error) {
      throw new Error("Невалідний або прострочений токен");
    }
  }

  async listRegistrationRequests() {
    return registrationRequestModel.find();
  }

  async approveRegistrationRequest(requestId: string): Promise<IAuthResponse> {
    const request = await registrationRequestModel.findById(requestId);
    if (!request) throw new Error("Запит на реєстрацію не знайдено");

    const user = await userService.createUserWithHash(
      request.name,
      request.email,
      request.passwordHash,
      request.requestedRole as UserRole,
      { birthdate: (request as any).birthdate }
    );
    await registrationRequestModel.findByIdAndDelete(requestId);

    const accessToken = jwt.sign({ id: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "15m" });
    const refreshToken = jwt.sign({ id: user._id, email: user.email, role: user.role }, JWT_REFRESH_SECRET, { expiresIn: "7d" });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user._id?.toString() || "",
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  async deleteRegistrationRequest(requestId: string): Promise<{ message: string }> {
    await registrationRequestModel.findByIdAndDelete(requestId);
    return { message: "Registration request deleted" };
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const user = await userModel.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) {
      throw new Error("Невалідний або прострочений токен скидання пароля");
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user password and clear reset token
    user.password = hashedPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    return { message: "Password updated successfully" };
  }
};
