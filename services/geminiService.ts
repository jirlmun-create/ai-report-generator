import { GoogleGenAI, Chat, Type, GenerateContentResponse } from '@google/genai';
import type { GuidelineFile, ReportData } from '../types';

// FIX: Initialize GoogleGenAI with the API key from environment variables as per guidelines.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// FIX: Use the 'gemini-2.5-flash' model as specified in the guidelines.
const model = 'gemini-2.5-flash';

let chat: Chat;

// Defines the JSON structure the AI should return for the report.
const reportSchema = {
  type: Type.OBJECT,
  properties: {
    basicInfo: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: "수급자 성명" },
        dob: { type: Type.STRING, description: "수급자 생년월일 (YYYY-MM-DD)" },
        gender: { type: Type.STRING, description: "수급자 성별 (남/여)" },
        admissionDate: { type: Type.STRING, description: "시설 입소일 (YYYY-MM-DD)" },
        dischargeDate: { type: Type.STRING, nullable: true, description: "시설 퇴소일 (YYYY-MM-DD), 없으면 null" },
        evaluationPeriod: { type: Type.STRING, description: "평가 대상 기간 (YYYY-MM-DD ~ YYYY-MM-DD)" },
        facilityName: { type: Type.STRING, description: "시설명" },
      },
      required: ['name', 'dob', 'gender', 'admissionDate', 'evaluationPeriod', 'facilityName']
    },
    evaluationItems: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          metric: { type: Type.STRING, description: "평가 지표명" },
          grade: { type: Type.STRING, description: "평가 등급 (우수, 양호, 불량, 해당없음, 자료 누락 중 하나)" },
          reason: { type: Type.STRING, description: "해당 등급을 받은 구체적인 사유" },
          evidence: { type: Type.STRING, description: "판단의 근거가 된 문서나 기록 내용" },
        },
        required: ['metric', 'grade', 'reason', 'evidence']
      }
    },
    crossCheckResults: {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                item: { type: Type.STRING, description: "교차점검 항목 (예: 급여제공의 적정성)" },
                status: { type: Type.STRING, description: "점검 결과 (예: 일부 불일치 확인)" },
                recommendation: { type: Type.STRING, description: "개선 권고 사항" },
            },
            required: ['item', 'status', 'recommendation']
        }
    },
    aiSummary: { 
        type: Type.STRING, 
        description: "보고서 전체 내용을 요약한 종합의견. Markdown 형식을 사용하여 주요 내용을 강조해주세요. (예: **주요 개선점**)" 
    },
  },
  required: ['basicInfo', 'evaluationItems', 'crossCheckResults', 'aiSummary']
};


const buildFileContentString = (files: GuidelineFile[]): string => {
    return files.map(file => `
--- FILE START: ${file.name} ---
${file.content}
--- FILE END: ${file.name} ---
`).join('\n');
};

export const generateReport = async (
    guidelineFiles: GuidelineFile[],
    evaluationFiles: GuidelineFile[]
): Promise<ReportData> => {
    const guidelineContent = buildFileContentString(guidelineFiles);
    const evaluationContent = buildFileContentString(evaluationFiles);

    const prompt = `
        당신은 장기요양기관 평가를 전문으로 하는 AI 컨설턴트입니다.
        당신의 임무는 제공된 '평가 지침 파일'과 '평가 자료 파일'을 면밀히 분석하여, 2026년 기준의 '장기요양 평가 AI 분석 보고서'를 JSON 형식으로 생성하는 것입니다.

        **지침:**
        1.  **기본 정보 추출:** '평가 자료 파일'에서 수급자의 기본 정보를 정확히 추출하여 'basicInfo' 객체를 채워주세요. 정보가 없으면 "정보 없음"으로 기재하세요.
        2.  **세부 지표 평가:** '평가 지침 파일'의 각 항목을 기준으로 '평가 자료 파일'의 내용을 평가하여 'evaluationItems' 배열을 완성하세요. 각 항목에 대해 '우수', '양호', '불량', '해당없음', '자료 누락' 중 하나의 등급을 부여하고, 구체적인 사유와 근거를 명시해야 합니다. 지침에 있는 모든 평가지표를 포함해야 합니다.
        3.  **교차 점검:** 법령 및 규정 준수 여부, 서류 간 내용 일치 여부 등을 확인하여 'crossCheckResults' 배열을 작성하세요. 문제가 발견된 경우, 개선 권고 사항을 포함해야 합니다.
        4.  **종합 요약:** 분석 결과를 바탕으로 전반적인 평가와 주요 개선점을 요약하여 'aiSummary'를 작성하세요. 중요한 부분은 Markdown의 bold체(\`**\`)를 사용하여 강조해주세요.
        5.  **정확성:** 반드시 제공된 파일의 내용에만 근거하여 분석하고, 추측이나 외부 정보는 배제해야 합니다.
        6.  **출력 형식:** 반드시 지정된 JSON 스키마를 준수하여 결과를 반환해야 합니다.

        --- 평가 지침 파일 내용 ---
        ${guidelineContent}
        
        --- 평가 자료 파일 내용 ---
        ${evaluationContent}
    `;

    try {
        // FIX: Use the correct method `ai.models.generateContent` as per guidelines.
        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: reportSchema,
                temperature: 0.1, // 낮게 설정하여 일관성 있는 결과 유도
            },
        });
        
        // FIX: Extract text directly from response object as per guidelines.
        const jsonText = response.text.trim();

        if (!jsonText) {
            throw new Error("AI로부터 빈 응답을 받았습니다.");
        }
        
        return JSON.parse(jsonText) as ReportData;

    } catch (error) {
        console.error("Gemini API 호출 중 오류 발생:", error);
        throw new Error("AI 보고서 생성에 실패했습니다. 입력 파일이나 API 키를 확인해주세요.");
    }
};

export const startChat = (reportData: ReportData) => {
    const systemInstruction = `
        당신은 방금 생성된 장기요양기관 평가 보고서에 대해 답변하는 전문 AI 챗봇입니다.
        주어진 보고서 데이터를 기반으로만 사용자의 질문에 친절하고 정확하게 답변해주세요.
        보고서에 없는 내용은 추측하지 말고, 정보가 없다고 솔직하게 말해야 합니다.
        
        보고서 내용:
        ${JSON.stringify(reportData)}
    `;
    
    // FIX: Use ai.chats.create to start a new chat session as per guidelines.
    chat = ai.chats.create({
      model: model,
      config: {
        systemInstruction: systemInstruction,
      },
    });
};

export const askQuestion = async (question: string): Promise<string> => {
    if (!chat) {
        return "오류: 챗 세션이 초기화되지 않았습니다. 새로운 분석을 시작해주세요.";
    }
    try {
        // FIX: Use chat.sendMessage to send a message as per guidelines.
        const response: GenerateContentResponse = await chat.sendMessage({ message: question });
        // FIX: Extract text directly from response object as per guidelines.
        return response.text;
    } catch (error) {
        console.error("Chat API 호출 중 오류 발생:", error);
        return "질문에 답변하는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
    }
};
