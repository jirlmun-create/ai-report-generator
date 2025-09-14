import { GoogleGenAI, Chat, Type, GenerateContentResponse } from "@google/genai";
import { GuidelineFile, ReportData } from '../types';

// Initialize the Gemini AI model.
// The API key must be provided via the process.env.API_KEY environment variable.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const model = 'gemini-2.5-flash';

let chat: Chat | null = null;

/**
 * Generates a comprehensive report by analyzing guideline and evaluation files.
 * @param guidelineFiles - Array of files containing evaluation guidelines.
 * @param evaluationFiles - Array of files containing evaluation data.
 * @returns A promise that resolves to the generated ReportData.
 */
export const generateReport = async (
    guidelineFiles: GuidelineFile[],
    evaluationFiles: GuidelineFile[]
): Promise<ReportData> => {
    const guidelineContent = guidelineFiles.map(f => `### 지침 파일: ${f.name}\n\n${f.content}`).join('\n\n---\n\n');
    const evaluationContent = evaluationFiles.map(f => `### 평가 자료 파일: ${f.name}\n\n${f.content}`).join('\n\n---\n\n');

    const systemInstruction = `
You are an expert AI assistant specializing in long-term care facility evaluations in South Korea.
Your task is to analyze the provided documents based on the given guidelines and generate a comprehensive evaluation report.
The report must be in JSON format and adhere strictly to the provided JSON schema.
- Analyze all provided documents: guidelines and evaluation materials.
- Identify the resident's basic information.
- Evaluate each metric defined in the guidelines.
- For each metric, provide a grade ('우수', '양호', '불량', '해당없음', '자료 누락'), a reason, and cite the evidence from the documents.
- Perform a cross-check based on legal and guideline requirements.
- Provide a final AI summary of the evaluation.
- All text in the report should be in Korean.
- The evaluation year is 2026.
`;

    const prompt = `
Please generate a long-term care evaluation report based on the following documents.

## 평가 지침 (Guidelines)
${guidelineContent}

## 평가 자료 (Evaluation Documents)
${evaluationContent}

Generate the report in JSON format according to the specified schema.
`;

    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            basicInfo: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING, description: "수급자 성명 (Resident's Name)" },
                    dob: { type: Type.STRING, description: "생년월일 (Date of Birth), YYYY-MM-DD format" },
                    gender: { type: Type.STRING, description: "성별 (Gender), '남' or '여'" },
                    admissionDate: { type: Type.STRING, description: "입소일 (Admission Date), YYYY-MM-DD format" },
                    dischargeDate: { type: Type.STRING, description: "퇴소일 (Discharge Date), YYYY-MM-DD format, or null if not applicable" },
                    evaluationPeriod: { type: Type.STRING, description: "평가 기간 (Evaluation Period)" },
                    facilityName: { type: Type.STRING, description: "시설명 (Facility Name)" },
                },
            },
            evaluationItems: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        metric: { type: Type.STRING, description: "평가 지표 (Evaluation Metric)" },
                        grade: { type: Type.STRING, description: "평가 등급 ('우수', '양호', '불량', '해당없음', '자료 누락')" },
                        reason: { type: Type.STRING, description: "평가 사유 (Reason for the grade)" },
                        evidence: { type: Type.STRING, description: "근거 자료 (Evidence from the documents)" },
                    },
                },
            },
            crossCheckResults: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        item: { type: Type.STRING, description: "점검 항목 (Cross-check item)" },
                        status: { type: Type.STRING, description: "점검 결과 상태 (Status of the check)" },
                        recommendation: { type: Type.STRING, description: "권고 사항 (Recommendation)" },
                    },
                },
            },
            aiSummary: {
                type: Type.STRING,
                description: "AI 종합 분석 요약 (Overall AI summary). Use markdown for formatting, like using ** for bolding key phrases."
            },
        },
    };

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                responseSchema: responseSchema,
                temperature: 0.2,
            },
        });
        
        const jsonText = response.text.trim();
        const reportData: ReportData = JSON.parse(jsonText);
        
        return reportData;
    } catch (error) {
        console.error("Error generating report with Gemini:", error);
        if (error instanceof Error) {
            throw new Error(`AI 분석 중 오류가 발생했습니다: ${error.message}`);
        }
        throw new Error("AI 분석 중 알 수 없는 오류가 발생했습니다.");
    }
};

/**
 * Initializes a chat session with the context of a generated report.
 * @param reportData - The report data to be used as context for the chat.
 */
export const startChat = (reportData: ReportData) => {
    const fullReportContext = `
You are a helpful AI assistant. You will answer questions about the following long-term care evaluation report.
The report is for the year 2026.
Do not provide information that is not present in the report.
All your answers must be in Korean.

--- BEGIN REPORT DATA ---
${JSON.stringify(reportData, null, 2)}
--- END REPORT DATA ---
`;
    
    chat = ai.chats.create({
        model: model,
        config: {
            systemInstruction: fullReportContext,
        },
    });
};

/**
 * Sends a user's question to the ongoing chat session and gets a response.
 * @param question - The user's question.
 * @returns A promise that resolves to the AI's response string.
 */
export const askQuestion = async (question: string): Promise<string> => {
    if (!chat) {
        throw new Error("Chat is not initialized. Call startChat first.");
    }

    try {
        const response: GenerateContentResponse = await chat.sendMessage({ message: question });
        return response.text;
    } catch (error) {
        console.error("Error sending message to Gemini:", error);
        return "죄송합니다. 질문에 답변하는 중 오류가 발생했습니다.";
    }
};
