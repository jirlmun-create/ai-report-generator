import { GoogleGenAI, Chat, GenerateContentResponse, Type } from "@google/genai";
import { GuidelineFile, ReportData } from '../types';
import { sleep } from '../utils/sleep';
import { chunkText } from "../utils/chunker";

// For Vite deployment, environment variables are accessed via import.meta.env
const apiKey = import.meta.env.VITE_API_KEY;

if (!apiKey) {
    throw new Error("VITE_API_KEY is not set in the environment variables.");
}

const ai = new GoogleGenAI({ apiKey });
const modelName = 'gemini-2.5-flash';

let chat: Chat | null = null;

const formatFilesForPrompt = (files: GuidelineFile[]): string => {
    if (files.length === 0) {
        return "No files provided.\n";
    }
    return files.map(file => `[File: ${file.name}]\n${file.content}\n\n`).join('');
};


export const summarizeTextChunk = async (guidelineContent: string, chunk: string): Promise<string> => {
    const systemInstruction = `You are an AI assistant that summarizes document chunks based on evaluation guidelines.
- The user will provide evaluation guidelines and a chunk of a document.
- Your task is to extract and list only the key points from the chunk that are directly relevant to the provided guidelines.
- Be concise and focus on facts, figures, and policy statements.
- The output must be in Korean.`;

    const userPrompt = `--- Evaluation Guidelines ---\n${guidelineContent}\n\n--- Document Chunk to Summarize ---\n${chunk}`;

    try {
        const response = await ai.models.generateContent({
            model: modelName,
            contents: userPrompt,
            config: {
                systemInstruction,
                temperature: 0.0,
            }
        });
        return response.text;
    } catch (error) {
        console.error("Error summarizing chunk:", error);
        // Return a specific message that can be filtered out later if needed
        return "Failed to summarize chunk.";
    }
};


export const generateReport = async (
    guidelineFiles: GuidelineFile[],
    summarizedContent: string, // Changed from evaluationFiles to summarizedContent
    onProgress: (progress: number, message: string) => void
): Promise<ReportData> => {
    onProgress(85, '종합 보고서 생성 중...');

    const guidelineContent = formatFilesForPrompt(guidelineFiles);

    const systemInstruction = `You are an expert AI assistant specializing in South Korea's long-term care insurance evaluations for day care centers. Your task is to analyze summarized documents against evaluation guidelines and generate a detailed, structured report in JSON format.
    
    - The year of evaluation is 2026.
    - Analyze the 'Summarized Evaluation Documents' based on the 'Evaluation Guidelines'.
    - If the summary for a topic is missing or insufficient, mark the grade as '자료 누락' (Data Missing).
    - Fill in all fields of the JSON schema accurately.
    - 'grade' can only be one of: '우수' (Excellent), '양호' (Good), '불량' (Poor), '해당없음' (Not Applicable), '자료 누락' (Data Missing).
    - Provide concise, factual reasons and cite evidence from the summaries.
    - The cross-check should identify inconsistencies based on the provided summaries.
    - The AI summary should be a professional, high-level overview of the findings.
    - All output must be in Korean.
    - Ensure the final output is a single, valid JSON object that strictly adheres to the provided schema. Do not include any markdown formatting like \`\`\`json.
    `;

    const userPrompt = `--- Evaluation Guidelines ---\n${guidelineContent}\n\n--- Summarized Evaluation Documents ---\n${summarizedContent}\n\nPlease generate the final report.`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        basicInfo: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "수급자 성명 (Recipient Name)" },
            dob: { type: Type.STRING, description: "생년월일 (Date of Birth)" },
            gender: { type: Type.STRING, description: "성별 (Gender)" },
            admissionDate: { type: Type.STRING, description: "입소일 (Admission Date)" },
            dischargeDate: { type: Type.STRING, description: "퇴소일 (Discharge Date), can be null" },
            evaluationPeriod: { type: Type.STRING, description: "평가기간 (Evaluation Period)" },
            facilityName: { type: Type.STRING, description: "시설명 (Facility Name)" },
          },
          required: ["name", "dob", "gender", "admissionDate", "evaluationPeriod", "facilityName"]
        },
        evaluationItems: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              metric: { type: Type.STRING, description: "평가지표 (Evaluation Metric)" },
              grade: { type: Type.STRING, description: "등급 ('우수', '양호', '불량', '해당없음', '자료 누락')" },
              reason: { type: Type.STRING, description: "평가 사유 (Reason for grade)" },
              evidence: { type: Type.STRING, description: "근거 자료 (Evidence, e.g., summary point)" },
            },
            required: ["metric", "grade", "reason", "evidence"]
          }
        },
        crossCheckResults: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              item: { type: Type.STRING, description: "교차점검 항목 (Cross-check item)" },
              status: { type: Type.STRING, description: "점검 결과 (Status, e.g., '일치', '불일치', '확인 불가')" },
              recommendation: { type: Type.STRING, description: "개선 권고 사항 (Recommendation)" },
            },
            required: ["item", "status", "recommendation"]
          }
        },
        aiSummary: {
          type: Type.STRING,
          description: "AI 종합 분석 요약 (AI Summary). Use markdown for formatting, like **bolding**."
        }
      },
      required: ["basicInfo", "evaluationItems", "crossCheckResults", "aiSummary"]
    };

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: modelName,
            contents: userPrompt,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                responseSchema: responseSchema,
                temperature: 0.2,
            },
        });
        onProgress(95, 'AI 응답 파싱 중...');
        
        const jsonText = response.text.trim();
        const reportData = JSON.parse(jsonText);
        
        if (!reportData.basicInfo || !reportData.evaluationItems) {
            throw new Error("AI response is missing required fields.");
        }

        onProgress(100, '보고서 생성 완료!');
        await sleep(500);
        
        return reportData as ReportData;

    } catch (error: any) {
        console.error("Error generating final report:", error);
        // Provide more detailed error information if available
        const errorMessage = error.details ? JSON.stringify(error.details) : error.message;
        throw new Error(`AI 분석 중 오류가 발생했습니다: ${errorMessage}`);
    }
};


export const startChat = (reportData: ReportData) => {
    const reportContext = JSON.stringify(reportData, null, 2);
    const systemInstruction = `You are a helpful AI assistant. You are now in a Q&A session about a report you just generated. The full report is provided below as context. Answer questions based only on this report. Be concise and helpful. All responses must be in Korean.

<report_context>
${reportContext}
</report_context>`;

    chat = ai.chats.create({
        model: modelName,
        config: {
            systemInstruction: systemInstruction,
        }
    });
};

export const askQuestion = async (question: string): Promise<string> => {
    if (!chat) {
        return "채팅 세션이 시작되지 않았습니다. 먼저 보고서를 생성해주세요.";
    }
    try {
        const response: GenerateContentResponse = await chat.sendMessage({ message: question });
        return response.text;
    } catch (error) {
        console.error("Error asking question:", error);
        return "질문에 답변하는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
    }
};
