import { Request, Response } from "express";
import { ApiResponse } from "../types/api.types";
import { IAttendanceResponse } from "../types/attendance.types";
import attendanceService from "./attendance-service";

export default new class AttendanceController {
  async getAttendance(
    req: Request<{ classId: string }>,
    res: Response
  ): Promise<Response<ApiResponse<IAttendanceResponse[]>>> {
    try {
      const { classId } = req.params;
      const records = await attendanceService.getAttendanceForClass(classId);
      return res.json({ success: true, data: records });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async addRecord(
    req: Request<{ classId: string }>,
    res: Response
  ): Promise<Response<ApiResponse<IAttendanceResponse>>> {
    try {
      const { classId } = req.params;
      const { date } = req.body as { date: string };

      if (!date) {
        return res.status(400).json({ success: false, error: "Дата є обов'язковою" });
      }

      const parsedDate = new Date(date);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({ success: false, error: "Невалідна дата" });
      }

      const record = await attendanceService.addAttendanceRecord(classId, parsedDate);
      return res.status(201).json({ success: true, data: record });
    } catch (error: any) {
      const status = error.message.includes("вже існує") ? 400 : 500;
      return res.status(status).json({ success: false, error: error.message });
    }
  }

  async updateAttendance(
    req: Request<{ classId: string; recordId: string; studentId: string }>,
    res: Response
  ): Promise<Response<ApiResponse<IAttendanceResponse>>> {
    try {
      const { recordId, studentId } = req.params;
      const { present } = req.body as { present: boolean };

      if (typeof present !== "boolean") {
        return res
          .status(400)
          .json({ success: false, error: "Поле present має бути булевим" });
      }

      const record = await attendanceService.updateAttendance(
        recordId,
        studentId,
        present
      );
      return res.json({ success: true, data: record });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async deleteRecord(
    req: Request<{ classId: string; recordId: string }>,
    res: Response
  ): Promise<Response<ApiResponse<null>>> {
    try {
      const { recordId } = req.params;
      await attendanceService.deleteAttendanceRecord(recordId);
      return res.json({ success: true, data: null });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }
}();
