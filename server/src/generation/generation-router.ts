import { Router } from "express";
import generationController from "./generation-controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const generationRouter = Router();

generationRouter.post(
  "/topic-matches",
  authMiddleware,
  requireRole(["student"]),
  generationController.matchMissedTopics
);

generationRouter.post(
  "/explanations",
  authMiddleware,
  requireRole(["student"]),
  generationController.generateExplanations
);

generationRouter.post(
  "/podcast",
  authMiddleware,
  requireRole(["student"]),
  generationController.generatePodcast
);

export default generationRouter;
