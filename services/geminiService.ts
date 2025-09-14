import { GoogleGenAI, Chat, GenerateContentResponse, Type } from "@google/genai";
import { ReportData, GuidelineFile } from '../types';

// The API key is now sourced from Vite's environment variables for client-side code.
// This is populated by GitHub Actions secrets during the build process.
const apiKey = import.meta.env.VITE_API_KEY;

if (!apiKey) {
  // This error will be thrown during runtime if the key is missing in the build.
  throw new Error("VITE_API_KEY environment variable not set. Please check your GitHub Secrets and Actions configuration.");
}

const ai = new GoogleGenAI({ apiKey: apiKey });

let chat: Chat;

const reportSchema = {
    type: Type.OBJECT,
    properties: {
        basicInfo: {
            type: Type.OBJECT,
            properties: {
                name: { type: Type.STRING, description: "수급자 성명. 마스킹 처리하지 않은 원본 이름. 찾을 수 없으면 '정보 없음'으로 표기." },
                dob: { type: Type.STRING, description: "생년월일 (YYYY-MM-DD). 찾을 수 없으면 '정보 없음'으로 표기." },
                gender: { type: Type.STRING, description: "성별 (남/여). 찾을 수 없으면 '정보 없음'으로 표기." },
                admissionDate: { type: Type.STRING, description: "입소일 (YYYY-MM-DD). 찾을 수 없으면 '정보 없음'으로 표기." },
                dischargeDate: { type: Type.STRING, description: "퇴소일 (YYYY-MM-DD), 없으면 null" },
                evaluationPeriod: { type: Type.STRING, description: "평가 대상 기간 (YYYY-MM-DD ~ YYYY-MM-DD). 찾을 수 없으면 '정보 없음'으로 표기." },
                facilityName: { type: Type.STRING, description: "시설명. 찾을 수 없으면 '정보 없음'으로 표기." },
            },
        },
        evaluationItems: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    metric: { type: Type.STRING, description: "평가지표명 (지침 파일에서 그대로 가져옴)" },
                    grade: { type: Type.STRING, description: "평가 등급 ('우수', '양호', '불량', '해당없음', '자료 누락' 중 하나)" },
                    reason: { type: Type.STRING, description: "등급 산정 사유를 간결하게 요약" },
                    evidence: { type: Type.STRING, description: "판단의 근거가 된 문서명과 핵심 내용을 명시. (예: '급여제공기록지(2025.03.15): 낙상예방교육 실시 내용 확인')" },
                },
            },
        },
        crossCheckResults: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    item: { type: Type.STRING, description: "교차점검 항목 (예: '필수 서류 누락', '기록 불일치')" },
                    status: { type: Type.STRING, description: "점검 결과 상태 (예: '운영규정 서류 누락', '급여제공시간 불일치 확인')" },
                    recommendation: { type: Type.STRING, description: "구체적인 권고 또는 개선 방안" },
                },
            },
        },
        aiSummary: {
            type: Type.STRING,
            description: "분석 결과에 대한 종합적인 요약. 강점, 약점, 주요 개선 필요 사항을 포함하여 서술형으로 작성. 중요한 키워드는 **키워드** 형식으로 강조."
        },
    },
    required: ["basicInfo", "evaluationItems", "crossCheckResults", "aiSummary"]
};

const buildPrompt = (guidelineFiles: GuidelineFile[], evaluationFiles: GuidelineFile[]): string => {
    let prompt = `
You are a specialized AI assistant for analyzing long-term care facility evaluation documents in South Korea.
Your task is to act as an expert evaluator and generate a comprehensive evaluation report based on the provided files.

**Instructions:**
1.  **Strictly Adhere to Guidelines**: The "Guideline Files" contain the official criteria, metrics, and standards. All your analysis must be based *only* on these guidelines. Do not use any prior knowledge.
2.  **Analyze Evaluation Files**: The "Evaluation Files" contain the facility's records. You must extract all relevant information about the resident and facility operations from these files.
3.  **Fact-Based Evaluation**: For each metric in the guidelines, find corresponding evidence in the evaluation files. Assign a grade ('우수', '양호', '불량', '해당없음', '자료 누락'). If no direct evidence is found for a required metric, you MUST grade it as '자료 누락'. Do not invent or assume information.
4.  **Perform Cross-Checks**: Identify inconsistencies or regulatory violations by cross-referencing information across different documents.
5.  **Generate a JSON Report**: Your final output must be a single, valid JSON object that strictly conforms to the provided schema. Do not include any text, notes, or markdown formatting outside of the JSON object.

---
**Guideline Files (The Only Source of Truth for Evaluation Criteria):**
${guidelineFiles.map(f => `\n\n--- FILE: ${f.name} ---\n${f.content}`).join('')}
---
**Evaluation Files (The Only Source of Truth for Facility Records):**
${evaluationFiles.map(f => `\n\n--- FILE: ${f.name} ---\n${f.content}`).join('')}
---

Now, based *only* on the provided files, generate the complete evaluation report in the specified JSON format.
`;
    return prompt;
};

export const analyzeDocuments = async (
    guidelineFiles: GuidelineFile[], 
    evaluationFiles: GuidelineFile[],
    onProgress: (message: string) => void
): Promise<ReportData> => {
    try {
        onProgress("AI 모델을 위한 프롬프트 구성 중...");
        const prompt = buildPrompt(guidelineFiles, evaluationFiles);
        
        onProgress("AI 분석을 요청하고 있습니다. 이 작업은 몇 분 정도 소요될 수 있습니다...");
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: reportSchema,
                temperature: 0.1, 
            },
        });

        onProgress("AI 분석 결과 수신 중...");
        const responseText = response.text;
        
        const reportData: ReportData = JSON.parse(responseText);
        onProgress("보고서 생성 완료!");

        return reportData;

    } catch (error) {
        console.error("Error during AI analysis:", error);
        // Provide a more user-friendly error message.
        if (error instanceof Error && error.message.includes('quota')) {
             throw new Error("API 사용량 한도를 초과했습니다. 잠시 후 다시 시도하거나, 분석할 파일의 양을 줄여주세요.");
        }
        if (error instanceof Error) {
            throw new Error(`AI 분석 중 오류가 발생했습니다: 입력 파일이나 API 키를 확인해주세요.`);
        }
        throw new Error("AI 분석 중 알 수 없는 오류가 발생했습니다. 입력 파일이나 API 키를 확인해주세요.");
    }
};

export const startChat = (reportData: ReportData) => {
    const reportSummary = JSON.stringify({
        basicInfo: reportData.basicInfo,
        evaluationSummary: reportData.evaluationItems.map(item => ({ metric: item.metric, grade: item.grade })),
        crossCheckSummary: reportData.crossCheckResults.map(item => ({ item: item.item, status: item.status })),
        aiSummary: reportData.aiSummary
    }, null, 2);

    const systemInstruction = `
You are an AI assistant designed to answer questions about a long-term care facility evaluation report.
You have been provided with a summary of the report in JSON format.
Your role is to answer the user's questions based *only* on the information contained within this report summary.
Do not invent, assume, or retrieve any information from outside this context.
If the answer cannot be found in the provided summary, state that the information is not available in the report.
Be helpful, concise, and accurate.

Here is the report summary:
${reportSummary}
`;

    chat = ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
            systemInstruction: systemInstruction,
        },
    });
};

export const askQuestion = async (question: string): Promise<string> => {
    if (!chat) {
        return "채팅 세션이 시작되지 않았습니다. 먼저 보고서를 생성해주세요.";
    }
    try {
        const result: GenerateContentResponse = await chat.sendMessage({ message: question });
        return result.text;
    } catch (error) {
        console.error("Error during chat:", error);
        return "죄송합니다, 질문에 답변하는 중 오류가 발생했습니다.";
    }
};
