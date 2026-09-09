export type ID = number;

export interface HealthResponse {
  status: string;
  app: string;
  version: string;
}

export interface InfoResponse {
  app: string;
  version: string;
  embedding_backend: string;
  llm_available: boolean;
  llm_model: string | null;
  scoring_weights: {
    required_skills: number;
    experience: number;
    projects: number;
    education_certifications: number;
    additional_skills: number;
  };
  allowed_extensions: string[];
  max_upload_mb: number;
}

export interface JobCreate {
  title: string;
  description: string;
}

export interface JobRequirementExtract {
  required_skills: string[];
  nice_to_have_skills: string[];
  min_experience_years: number | null;
  required_education: string | null;
  requirements_summary: string | null;
}

export interface JobResponse {
  id: ID;
  title: string;
  description: string;
  requirements: JobRequirementExtract | null;
  required_skills: string[] | null;
  nice_to_have_skills: string[] | null;
  min_experience_years: number | null;
  required_education: string | null;
  created_at: string;
}

export interface JobListResponse {
  jobs: JobResponse[];
  total: number;
}

export interface CandidateProfile {
  name: string | null;
  email: string | null;
  phone: string | null;
  skills: string[];
  experience_years: number | null;
  experience_summary: string | null;
  education: Array<Record<string, unknown>>;
  projects: Array<Record<string, unknown>>;
  certifications: string[];
  additional_skills: string[];
}

export interface CandidateResponse {
  id: ID;
  job_id: ID;
  resume_file_name: string;
  profile: CandidateProfile;
  created_at: string;
}

export interface CandidateListResponse {
  candidates: CandidateResponse[];
  total: number;
}

export interface CandidateUploadResponse {
  success: boolean;
  message: string;
  candidates: CandidateResponse[];
  errors: Array<{ file: string; error: string }>;
}

export interface MatchRequest {
  job_id: ID;
  candidate_ids?: ID[];
  rerun?: boolean;
}

export interface CategoryScores {
  required_skills_score: number;
  experience_score: number;
  projects_score: number;
  education_cert_score: number;
  additional_skills_score: number;
}

export interface SkillGap {
  matching_skills: string[];
  missing_skills: string[];
}

export interface MatchResultResponse {
  candidate_id: ID;
  candidate_name: string | null;
  overall_score: number;
  scores: CategoryScores;
  skill_gap: SkillGap;
  strengths: string[];
  weaknesses: string[];
  explanation: string | null;
  rank: number | null;
}

export interface MatchRunResponse {
  job_id: ID;
  total_matches: number;
  matches: MatchResultResponse[];
}

export interface RankingResponse {
  job_id: ID;
  job_title: string;
  ranked_candidates: MatchResultResponse[];
  total: number;
}

export interface ErrorResponse {
  detail: string;
  code?: string;
}

export interface ApiErrorShape {
  message: string;
  code: string;
  status: number;
}

export type CandidateListParams = {
  job_id?: ID | null;
  skip?: number;
  limit?: number;
};
