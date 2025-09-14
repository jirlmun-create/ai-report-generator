import { GoogleGenAI, Chat, Type } from "@google/genai";
import { GuidelineFile, ReportData } from '../types';

// For Vite deployment (like GitHub Pages), environment variables are accessed via import.meta.env
// The VITE_ prefix is required by Vite for security reasons.
// The GitHub Action workflow will inject the secret API key into this variable during the build process.
const apiKey = import.meta.env.VITE_API_KEY;

if (!apiKey) {
    throw new Error("VITE_API_KEY is not set in the environment.");
}

const ai = new GoogleGenAI({apiKey: apiKey});

let chat: Chat | null = null;


const buildReportGenerationPrompt = (guidelines: GuidelineFile[], evaluationFiles: GuidelineFile[]): string => {
    const guidelineContent = guidelines.map(f => `### ${f.name}\n\n${f.content}`).join('\n\n---\n\n');
    const evaluationContent = evaluationFiles.map(f => `### ${f.name}\n\n${f.content}`).join('\n\n---\n\n');

    return `
# 장기요양 평가 AI 분석 요청

## 1. 평가 기준 지침 파일 내용
${guidelineContent}

## 2. 분석 대상 평가 자료 내용
${evaluationContent}

## 3. 분석 요청 사항
위의 '평가 기준 지침'과 '분석 대상 평가 자료'를 바탕으로, 다음의 JSON 형식에 맞춰 "2026년 장기요양기관 재가급여(주간보호) 평가" 보고서를 생성해주세요.

**JSON 출력 형식:**
{
  "basicInfo": {
    "name": "수급자 성명",
    "dob": "생년월일 (YYYY-MM-DD)",
    "gender": "성별 (남/여)",
    "admissionDate": "입소일 (YYYY-MM-DD)",
    "dischargeDate": "퇴소일 (YYYY-MM-DD 또는 null)",
    "evaluationPeriod": "평가 기간 (YYYY-MM-DD ~ YYYY-MM-DD)",
    "facilityName": "시설명"
  },
  "evaluationItems": [
    {
      "metric": "평가지표명 (예: 급여제공계획의 수립 및 안내)",
      "grade": "평가 등급 ('우수', '양호', '불량', '해당없음', '자료 누락')",
      "reason": "등급 산정의 구체적인 이유",
      "evidence": "판단의 근거가 된 문서와 내용 요약"
    }
  ],
  "crossCheckResults": [
    {
      "item": "교차 점검 항목 (예: 급여제공계획과 실제 제공 기록의 일치 여부)",
      "status": "점검 결과 (예: '일치', '불일치', '확인 필요')",
      "recommendation": "개선 권장 사항"
    }
  ],
  "aiSummary": "종합적인 AI 분석 요약. Markdown 형식을 사용하여 주요 사항을 강조해주세요. (예: **주요 개선점**)"
}

**주의사항:**
- 모든 필드는 반드시 채워져야 합니다. 정보가 없는 경우 "정보 없음" 또는 "해당 없음"으로 표기해주세요.
- 평가는 제공된 '2026년 장기요양기관 재가급여(주간보호) 평가 매뉴얼'을 기준으로 엄격하게 진행해주세요.
- 'evaluationItems' 배열에는 매뉴얼의 모든 평가지표에 대한 결과를 포함해야 합니다.
- 'aiSummary'는 전문가적인 견해를 담아 구체적이고 실행 가능한 제안을 포함해야 합니다.
- 응답은 반드시 JSON 객체만 포함해야 하며, 다른 텍스트나 설명은 추가하지 마세요.
`;
}


/**
 * Generates a report by analyzing guideline and evaluation files using the Gemini API.
 */
export const generateReport = async (guidelines: GuidelineFile[], evaluationFiles: GuidelineFile[]): Promise<ReportData> => {
    
    const guidelineContent = guidelines.map(f => `### 지침 파일명: ${f.name}\n\n${f.content}`).join('\n\n---\n\n');
    const evaluationContent = evaluationFiles.map(f => `### 분석 자료명: ${f.name}\n\n${f.content}`).join('\n\n---\n\n');

    const systemInstruction = `당신은 대한민국 장기요양기관 평가 전문가입니다. 당신의 임무는 제공된 '평가 기준 지침'을 유일한 규칙으로 삼아, '분석 대상 평가 자료'를 분석하는 것입니다. 분석 결과는 반드시 지정된 JSON 형식으로만 출력해야 합니다. 당신의 기존 지식은 사용하지 마십시오. 만약 지침에 명시된 항목이 평가 자료에서 발견되지 않으면, 'grade'를 '자료 누락'으로 표기하고 그 사실을 'reason'에 명시해야 합니다.
    
    ---
    [평가 기준 지침]
    ${guidelineContent}
    ---
    `;

    const model = 'gemini-2.5-flash';

    const responseSchema = {
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
                required: ['name', 'dob', 'gender', 'admissionDate', 'evaluationPeriod', 'facilityName']
            },
            evaluationItems: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        metric: { type: Type.STRING },
                        grade: { type: Type.STRING, enum: ['우수', '양호', '불량', '해당없음', '자료 누락'] },
                        reason: { type: Type.STRING },
                        evidence: { type: Type.STRING }
                    },
                    required: ['metric', 'grade', 'reason', 'evidence']
                }
            },
            crossCheckResults: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        item: { type: Type.STRING },
                        status: { type: Type.STRING },
                        recommendation: { type: Type.STRING }
                    },
                    required: ['item', 'status', 'recommendation']
                }
            },
            aiSummary: {
                type: Type.STRING
            }
        },
        required: ['basicInfo', 'evaluationItems', 'crossCheckResults', 'aiSummary']
    };

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: evaluationContent,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: 'application/json',
                responseSchema: responseSchema,
                temperature: 0.2,
            }
        });
        
        const jsonText = response.text.trim();
        const reportData: ReportData = JSON.parse(jsonText);
        return reportData;
    } catch (error) {
        console.error("Error generating report with Gemini API:", error);
        if (error instanceof Error) {
             throw new Error(`AI 보고서 생성에 실패했습니다. 입력 파일이나 API 키를 확인해주세요.`);
        }
        throw new Error("AI 보고서 생성 중 알 수 없는 오류가 발생했습니다.");
    }
}

const buildChatSystemInstruction = (reportData: ReportData): string => {
    const reportJsonString = JSON.stringify(reportData, null, 2);
    return `
You are an expert AI assistant specialized in analyzing Long-Term Care Evaluation Reports for daycare centers in South Korea, based on the 2026 standards.
Your role is to answer questions about the provided report.
You must base your answers STRICTLY on the content of the report provided below. Do not invent information or refer to external knowledge.
If a question cannot be answered from the report, state that the information is not available in the provided document.
Be concise, clear, and professional in your responses.
When asked about specific evaluation items, refer to the metric, grade, and reason from the report.

Here is the report data in JSON format:
\`\`\`json
${reportJsonString}
\`\`\`
`;
}


export const startChat = (reportData: ReportData) => {
    const model = 'gemini-2.5-flash';
    const systemInstruction = buildChatSystemInstruction(reportData);

    chat = ai.chats.create({
        model: model,
        config: {
            systemInstruction: systemInstruction,
        }
    });
};


export const askQuestion = async (question: string): Promise<string> => {
    if (!chat) {
        throw new Error("Chat is not initialized. Call startChat first.");
    }
    try {
        const response = await chat.sendMessage({ message: question });
        return response.text;
    } catch (error) {
        console.error("Error sending message to Gemini API:", error);
        if (error instanceof Error) {
            return `질문에 답변하는 중 오류가 발생했습니다: ${error.message}`;
        }
        return "질문에 답변하는 중 알 수 없는 오류가 발생했습니다.";
    }
};