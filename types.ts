
export enum AppState {
  Idle = 'IDLE',
  Processing = 'PROCESSING',
  Report = 'REPORT',
  Error = 'ERROR',
}

export interface GuidelineFile {
  name: string;
  content: string;
}

export interface BasicInfo {
  name: string;
  dob: string;
  gender: string;
  admissionDate: string;
  dischargeDate: string | null;
  evaluationPeriod: string;
  facilityName: string;
}

export interface EvaluationItem {
  metric: string;
  grade: '우수' | '양호' | '불량' | '해당없음' | '자료 누락';
  reason: string;
  evidence: string;
}

export interface CrossCheckResult {
  item: string;
  status: string;
  recommendation: string;
}

export interface ReportData {
  basicInfo: BasicInfo;
  evaluationItems: EvaluationItem[];
  crossCheckResults: CrossCheckResult[];
  aiSummary: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}
