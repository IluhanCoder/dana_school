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
  async registerRequest(name: string, email: string, password: string, requestedRole: UserRole = "student"): Promise<{ message: string }> {
    const existingUser = await userService.getUserByEmail(email);
    if (existingUser) {
      throw new Error("User already exists with this email");
    }

    const existingRequest = await registrationRequestModel.findOne({ email });
    if (existingRequest) {
      throw new Error("Registration request already submitted for this email");
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await registrationRequestModel.create({ name, email, passwordHash, requestedRole });
    return { message: "Registration request submitted and pending admin approval" };
  }

  async login(email: string, password: string): Promise<IAuthResponse> {
    // Find user by email
    const user = await userService.getUserByEmail(email);
    if (!user) {
      throw new Error("Invalid email or password");
    }
    if ((user as any).isArchived) {
      throw new Error("Account is archived");
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new Error("Invalid email or password");
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
      throw new Error("Invalid refresh token");
    }
  }

  verifyToken(token: string): IDecodedToken {
    try {
      return jwt.verify(token, JWT_SECRET) as IDecodedToken;
    } catch (error) {
      throw new Error("Invalid or expired token");
    }
  }

  async listRegistrationRequests() {
    return registrationRequestModel.find();
  }

  async approveRegistrationRequest(requestId: string): Promise<IAuthResponse> {
    const request = await registrationRequestModel.findById(requestId);
    if (!request) throw new Error("Registration request not found");

    const user = await userService.createUserWithHash(request.name, request.email, request.passwordHash, request.requestedRole as UserRole);
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
      throw new Error("Invalid or expired password reset token");
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
