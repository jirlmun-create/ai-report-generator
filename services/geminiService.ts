import { GoogleGenAI, Type, Chat, GenerateContentResponse } from "@google/genai";
import { GuidelineFile, ReportData } from '../types';

// Per guidelines: Always use `const ai = new GoogleGenAI({apiKey: process.env.API_KEY});`.
// The API key MUST be obtained exclusively from the environment variable `process.env.API_KEY`.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

// Schema for the report data, matching the ReportData interface in types.ts
const reportSchema = {
    type: Type.OBJECT,
    properties: {
        basicInfo: {
            type: Type.OBJECT,
            properties: {
                name: { type: Type.STRING, description: "수급자 성명" },
                dob: { type: Type.STRING, description: "수급자 생년월일 (YYYY-MM-DD)" },
                gender: { type: Type.STRING, description: "수급자 성별 (남/여)" },
                admissionDate: { type: Type.STRING, description: "입소일 (YYYY-MM-DD)" },
                dischargeDate: { type: Type.STRING, description: "퇴소일 (YYYY-MM-DD), 없으면 null" },
                evaluationPeriod: { type: Type.STRING, description: "평가 기간 (YYYY-MM-DD ~ YYYY-MM-DD)" },
                facilityName: { type: Type.STRING, description: "시설명" },
            },
            required: ['name', 'dob', 'gender', 'admissionDate', 'evaluationPeriod', 'facilityName']
        },
        evaluationItems: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    metric: { type: Type.STRING, description: "평가지표명" },
                    grade: { type: Type.STRING, enum: ['우수', '양호', '불량', '해당없음', '자료 누락'], description: "평가 등급" },
                    reason: { type: Type.STRING, description: "등급 산정 사유" },
                    evidence: { type: Type.STRING, description: "판단의 근거가 된 문서 내용 또는 파일명" },
                },
                required: ['metric', 'grade', 'reason', 'evidence']
            }
        },
        crossCheckResults: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    item: { type: Type.STRING, description: "점검 항목" },
                    status: { type: Type.STRING, description: "점검 결과 상태 (예: 불일치, 확인 필요)" },
                    recommendation: { type: Type.STRING, description: "권장 조치 사항" },
                },
                required: ['item', 'status', 'recommendation']
            }
        },
        aiSummary: {
            type: Type.STRING,
            description: "AI가 분석한 종합 요약. 강점과 개선점을 포함하며, 중요한 부분은 마크다운(**text**)으로 강조."
        }
    },
    required: ['basicInfo', 'evaluationItems', 'crossCheckResults', 'aiSummary']
};


const buildPrompt = (guidelineFiles: GuidelineFile[], evaluationFiles: GuidelineFile[]): string => {
    const guidelinesContent = guidelineFiles.map(f => `### 지침 파일: ${f.name}\n\n\`\`\`\n${f.content}\n\`\`\``).join('\n\n');
    const evaluationContent = evaluationFiles.map(f => `### 평가 자료 파일: ${f.name}\n\n\`\`\`\n${f.content}\n\`\`\``).join('\n\n');

    return `
# AI 장기요양평가 보고서 생성 요청

## 분석 목표
당신은 장기요양기관 평가 전문가 AI입니다. 제공된 '평가 지침'을 기준으로 '평가 대상 자료'를 면밀히 분석하여, 요청된 JSON 형식에 맞춰 종합적인 평가 보고서를 생성해야 합니다. 모든 텍스트는 한국어로 작성해주세요.

## 평가 지침
${guidelinesContent}

## 평가 대상 자료
${evaluationContent}

## 생성할 보고서 내용 및 요청사항
1.  **기본 정보 (basicInfo)**: 평가 대상 자료에서 이름, 생년월일, 성별, 입소일, 퇴소일, 평가기간, 시설명 등 기본 정보를 정확히 추출하세요. 퇴소일이 없는 경우 null 값을 사용하세요.
2.  **세부 평가항목 (evaluationItems)**: '평가 지침'에 명시된 각 평가지표에 따라 '평가 대상 자료'를 분석하세요. 각 지표에 대해 '우수', '양호', '불량', '해당없음', '자료 누락' 중 하나의 등급을 부여하고, 명확한 사유와 근거(어떤 문서의 어떤 내용인지)를 제시하세요.
3.  **교차 점검 결과 (crossCheckResults)**: 여러 문서에 걸쳐 있는 정보들을 비교하여 불일치하거나 모순되는 점이 있는지 확인하세요. 발견된 경우, 해당 항목과 상태(예: 불일치), 그리고 권장 조치를 명시하세요.
4.  **AI 종합 요약 (aiSummary)**: 전체 분석 결과를 바탕으로 종합적인 요약 보고서를 생성하세요. 주요 강점과 개선이 필요한 영역을 명확히 구분하여 설명하고, 중요한 키워드나 문장은 마크다운 형식(**text**)으로 강조해주세요.

**출력 형식**: 아래에 정의된 JSON 스키마를 엄격히 준수하여 결과를 반환해야 합니다. 다른 설명 없이 JSON 객체만 출력해주세요.
`;
};


export const generateReport = async (guidelineFiles: GuidelineFile[], evaluationFiles: GuidelineFile[]): Promise<ReportData> => {
    const prompt = buildPrompt(guidelineFiles, evaluationFiles);

    try {
        const response = await ai.models.generateContent({
            // Per guidelines, use 'gemini-2.5-flash' for general text tasks.
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                // Per guidelines, use responseMimeType and responseSchema for JSON output.
                responseMimeType: "application/json",
                responseSchema: reportSchema,
                temperature: 0.2, // A lower temperature for more deterministic, fact-based output
            },
        });
        
        // Per guidelines, the simplest and most direct way to get the generated text content is by accessing the .text property
        const jsonText = response.text;
        
        if (!jsonText) {
             throw new Error("AI 응답이 비어있습니다. 입력 파일의 내용을 확인해주세요.");
        }
        
        // The response should be a JSON string, parse it.
        const reportData: ReportData = JSON.parse(jsonText);
        return reportData;
    } catch (error) {
        console.error("Error generating report with Gemini API:", error);
        // Provide a more user-friendly error message
        if (error instanceof Error) {
            if(error.message.includes('API key')) {
                 throw new Error("Gemini API 키가 유효하지 않거나 설정되지 않았습니다. 환경 변수를 확인해주세요.");
            }
        }
        throw new Error("AI 보고서 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    }
};


// Module-level variable to hold the chat session
let chatSession: Chat | undefined;

export const startChat = (reportData: ReportData) => {
    const reportSummary = JSON.stringify(reportData, null, 2);
    const systemInstruction = `
You are an AI assistant specialized in analyzing long-term care evaluation reports for facilities in South Korea.
You will be answering questions about a specific report that has already been generated.
The full report data is provided below for your reference.
Base all your answers strictly on the information contained within this report. Do not invent information.
If the user asks something that cannot be answered from the report, state that the information is not available in the provided data.
The report is written in Korean, so all your responses must also be in Korean.

Here is the report data:
\`\`\`json
${reportSummary}
\`\`\`
`;

    // Per guidelines, use ai.chats.create to start a chat.
    chatSession = ai.chats.create({
        // Per guidelines, use 'gemini-2.5-flash' for general text tasks.
        model: 'gemini-2.5-flash',
        config: {
            systemInstruction: systemInstruction,
        },
    });
};

export const askQuestion = async (question: string): Promise<string> => {
    if (!chatSession) {
        throw new Error("Chat session not started. Please call startChat first.");
    }
    
    try {
        // Per guidelines, use chat.sendMessage to send a message.
        const response: GenerateContentResponse = await chatSession.sendMessage({ message: question });

        // Per guidelines, access the .text property for the response.
        return response.text;
    } catch (error) {
        console.error("Error asking question with Gemini API:", error);
        return "죄송합니다, 질문에 답변하는 중 오류가 발생했습니다.";
    }
};
