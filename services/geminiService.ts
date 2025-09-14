import { GoogleGenAI, Chat, GenerateContentResponse, Type } from "@google/genai";
import type { ReportData, GuidelineFile } from '../types';

// For deployment, Vite will replace `import.meta.env.VITE_API_KEY`.
// In the AI Studio dev environment, `process.env.API_KEY` will be used.
const apiKey = (import.meta.env.VITE_API_KEY || process.env.API_KEY);

if (!apiKey) {
    throw new Error("API_KEY is not set. Please configure it in your environment secrets.");
}

const ai = new GoogleGenAI({ apiKey });

let chat: Chat | null = null;

const reportSchema = {
    type: Type.OBJECT,
    properties: {
        basicInfo: {
            type: Type.OBJECT,
            properties: {
                name: { type: Type.STRING },
                dob: { type: Type.STRING },
                gender: { type: Type.STRING },
                admissionDate: { type: Type.STRING },
                dischargeDate: { type: Type.STRING, nullable: true },
                evaluationPeriod: { type: Type.STRING },
                facilityName: { type: Type.STRING },
            },
            required: ['name', 'dob', 'gender', 'admissionDate', 'evaluationPeriod', 'facilityName'],
        },
        evaluationItems: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    metric: { type: Type.STRING },
                    grade: { type: Type.STRING }, // '우수', '양호', '불량', '해당없음', '자료 누락'
                    reason: { type: Type.STRING },
                    evidence: { type: Type.STRING },
                },
                required: ['metric', 'grade', 'reason', 'evidence'],
            },
        },
        crossCheckResults: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    item: { type: Type.STRING },
                    status: { type: Type.STRING },
                    recommendation: { type: Type.STRING },
                },
                required: ['item', 'status', 'recommendation'],
            },
        },
        aiSummary: { type: Type.STRING },
    },
    required: ['basicInfo', 'evaluationItems', 'crossCheckResults', 'aiSummary'],
};


export const generateReport = async (
    guidelineFiles: GuidelineFile[],
    evaluationFiles: GuidelineFile[]
): Promise<ReportData> => {
    
    const guidelineContent = guidelineFiles.map(f => `### ${f.name}\n\n${f.content}`).join('\n\n---\n\n');
    const evaluationContent = evaluationFiles.map(f => `### ${f.name}\n\n${f.content}`).join('\n\n---\n\n');

    const prompt = `
        **지시사항:**
        당신은 장기요양기관 평가 전문가 AI입니다. 제공된 평가 매뉴얼(지침)과 제출된 서류를 바탕으로 "2026년 장기요양 평가 AI 분석 보고서 (주간보호)"를 생성해야 합니다.
        
        **평가 기준:**
        ${guidelineContent}

        **제출 서류 내용:**
        ${evaluationContent}

        **출력 형식:**
        아래의 JSON 스키마에 맞춰 보고서 데이터를 정확하게 생성해 주세요.
        - 모든 필드는 한국어로 작성해야 합니다.
        - 'basicInfo' 섹션: 제출 서류에서 핵심 인적사항 및 기관 정보를 추출하여 채워주세요. 만약 정보가 없다면 "자료 없음"으로 표기하세요. 퇴소일이 없으면 null로 설정하세요.
        - 'evaluationItems' 섹션: 평가 매뉴얼의 각 지표에 대해 제출 서류를 근거로 평가하고, '우수', '양호', '불량', '해당없음', '자료 누락' 중 하나의 등급을 부여하세요. 각 항목에 대한 명확한 사유와 근거(어떤 서류의 어떤 내용)를 제시해야 합니다.
        - 'crossCheckResults' 섹션: 법령/지침과 제출된 데이터 간의 불일치나 모순점을 3가지 이상 찾아서 지적하고, 개선 권장사항을 제시하세요.
        - 'aiSummary' 섹션: 전체 평가 결과에 대한 종합적인 요약 및 제언을 3~4문단으로 작성해주세요. 중요한 키워드는 **이렇게** 강조 표시해주세요.

        결과는 반드시 JSON 형식으로만 반환해야 합니다. 다른 설명은 추가하지 마세요.
    `;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: reportSchema,
            },
        });

        const jsonText = response.text.trim();
        const cleanedJsonText = jsonText.replace(/^```json\n?/, '').replace(/```$/, '');
        const reportData: ReportData = JSON.parse(cleanedJsonText);
        return reportData;

    } catch (error) {
        console.error("Error generating report:", error);
        throw new Error("AI 보고서 생성에 실패했습니다. 입력 파일이나 API 키를 확인해주세요.");
    }
};

export const startChat = (reportData: ReportData) => {
    const systemInstruction = `
        당신은 내가 제공하는 보고서에 대해 질문에 답변하는 AI 챗봇입니다.
        보고서의 내용은 다음과 같습니다:
        ${JSON.stringify(reportData)}
        
        이제부터 이 보고서 내용에 기반해서만 답변해주세요. 보고서에 없는 내용은 추측하지 말고 모른다고 답변하세요.
    `;
    
    chat = ai.chats.create({
        model: 'gemini-2.5-flash',
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
        const response = await chat.sendMessage({ message: question });
        return response.text;
    } catch (error) {
        console.error("Error sending message to chat:", error);
        return "질문에 답변하는 중 오류가 발생했습니다. 다시 시도해주세요.";
    }
};