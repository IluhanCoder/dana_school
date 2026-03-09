import { Router } from "express";
import multer from "multer";
import subjectController from "./subject-controller";
import journalController from "../journal/journal-controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const subjectRouter = Router();
const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 20 * 1024 * 1024 },
	fileFilter: (_req, file, cb) => {
		if (file.mimetype !== "application/pdf") {
			return cb(new Error("Only PDF files are allowed"));
		}
		cb(null, true);
	},
});

const uploadPdfMiddleware = (req: any, res: any, next: any) => {
	upload.single("file")(req, res, (err: any) => {
		if (!err) return next();
		if (err instanceof multer.MulterError) {
			return res.status(400).json({ success: false, error: err.message || "Upload error" });
		}
		return res.status(400).json({ success: false, error: err.message || "Invalid upload request" });
	});
};

subjectRouter.get("/", authMiddleware, requireRole(["admin", "teacher", "student"]), subjectController.getSubjects);
subjectRouter.post("/", authMiddleware, requireRole(["admin"]), subjectController.createSubject);
subjectRouter.get("/:id/materials", authMiddleware, requireRole(["admin", "teacher"]), subjectController.getMaterials);
subjectRouter.post("/:id/materials", authMiddleware, requireRole(["admin", "teacher"]), uploadPdfMiddleware, subjectController.uploadMaterial);

// Journal routes - must come before /:id routes
subjectRouter.post("/journals/:journalId/lessons", authMiddleware, requireRole(["admin", "teacher"]), journalController.addLesson);
subjectRouter.delete("/journals/:journalId/lessons/:lessonId", authMiddleware, requireRole(["admin", "teacher"]), journalController.deleteLesson);
subjectRouter.patch("/journals/:journalId/lessons/:lessonId", authMiddleware, requireRole(["admin", "teacher"]), journalController.updateLessonMark);
subjectRouter.post("/:id/journals", authMiddleware, requireRole(["admin"]), journalController.createJournal);
subjectRouter.post("/:id/journals/:journalId/sync", authMiddleware, requireRole(["admin"]), journalController.syncJournalStudents);
subjectRouter.delete("/:id/journals/:journalId", authMiddleware, requireRole(["admin", "teacher"]), journalController.deleteJournal);

// Routes with :id parameter - must come last
subjectRouter.patch("/:id/teacher", authMiddleware, requireRole(["admin"]), subjectController.updateSubjectTeacher);
subjectRouter.delete("/:id", authMiddleware, requireRole(["admin"]), subjectController.deleteSubject);
subjectRouter.get("/:id", authMiddleware, requireRole(["admin", "teacher", "student"]), subjectController.getSubject);

export default subjectRouter;
