import { Request, Response } from "express";
import { ApiResponse } from "../types/api.types";
import generationService from "./generation-service";
import {
  IPodcastRequestInput,
  IMissedLessonInput,
  ITopicExplanationInput,
  ITopicExplanationResult,
  ITopicMaterialMatch,
} from "../types/generation.types";

export default new (class GenerationController {
  async matchMissedTopics(req: any, res: Response): Promise<Response<ApiResponse<ITopicMaterialMatch[]>>> {
    try {
      const userId = req.userId as string | undefined;
      if (!userId) {
        return res.status(401).json({ success: false, error: "Unauthorized" });
      }

      const missedLessons = (req.body?.missedLessons || []) as IMissedLessonInput[];
      const matches = await generationService.matchTopicsWithMaterials(userId, missedLessons);
      return res.json({ success: true, data: matches });
    } catch (error: any) {
      const status = error?.message === "Forbidden" ? 403 : 400;
      return res.status(status).json({ success: false, error: error.message || "Generation failed" });
    }
  }

  async generateExplanations(req: any, res: Response): Promise<Response<ApiResponse<ITopicExplanationResult[]>>> {
    try {
      const userId = req.userId as string | undefined;
      if (!userId) {
        return res.status(401).json({ success: false, error: "Unauthorized" });
      }

      const items = (req.body?.items || []) as ITopicExplanationInput[];
      const explanations = await generationService.generateExplanations(userId, items);
      return res.json({ success: true, data: explanations });
    } catch (error: any) {
      const status = error?.message === "Forbidden" ? 403 : 400;
      return res.status(status).json({ success: false, error: error.message || "Explanation generation failed" });
    }
  }

  async generatePodcast(req: any, res: Response): Promise<Response | void> {
    try {
      const userId = req.userId as string | undefined;
      if (!userId) {
        return res.status(401).json({ success: false, error: "Unauthorized" });
      }

      const payload = (req.body || {}) as IPodcastRequestInput;
      const podcast = await generationService.generatePodcastAudio(userId, payload);

      res.setHeader("Content-Type", podcast.mimeType);
      const asciiFileName = podcast.fileName.replace(/[^\x20-\x7E]/g, "");
      const encodedUtf8Name = encodeURIComponent(podcast.fileName);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=\"${asciiFileName || "podcast.mp3"}\"; filename*=UTF-8''${encodedUtf8Name}`
      );
      return res.status(200).send(podcast.audioBuffer);
    } catch (error: any) {
      const status = error?.message === "Forbidden" ? 403 : 400;
      return res.status(status).json({ success: false, error: error.message || "Podcast generation failed" });
    }
  }
})();
