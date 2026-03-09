export interface IMissedLessonInput {
  subjectId: string;
  subjectName: string;
  date: string;
  topic: string;
}

export interface ITopicMaterialMatch {
  lessonDate: string;
  topic: string;
  subjectId: string;
  subjectName: string;
  materialTitle: string | null;
  snippet: string;
  score: number;
}

export interface ITopicExplanationInput {
  lessonDate: string;
  topic: string;
  subjectId: string;
  subjectName: string;
  materialTitle: string | null;
  snippet: string;
  score?: number;
  forceRegenerate?: boolean;
}

export interface ITopicExplanationResult {
  lessonDate: string;
  topic: string;
  subjectId: string;
  subjectName: string;
  materialTitle: string | null;
  explanation: string;
  usedExternalKnowledge: boolean;
  cached: boolean;
}

export interface IPodcastItemInput {
  lessonDate: string;
  topic: string;
  explanation: string;
}

export interface IPodcastRequestInput {
  subjectId: string;
  subjectName: string;
  items: IPodcastItemInput[];
}
