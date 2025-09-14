import React, { useEffect } from 'react';
import type { ReportData, EvaluationItem, CrossCheckResult, ChatMessage } from '../types';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { startChat, askQuestion } from '../services/geminiService';

const ReportSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 mb-6 print:shadow-none print:border-none">
    <h3 className="text-xl font-bold text-gray-800 border-b-2 border-blue-500 pb-2 mb-4">{title}</h3>
    {children}
  </div>
);

const BasicInfoCard: React.FC<{ info: ReportData['basicInfo'] }> = ({ info }) => (
  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
    <div><span className="font-semibold text-gray-600">성명:</span> {info.name}</div>
    <div><span className="font-semibold text-gray-600">생년월일:</span> {info.dob}</div>
    <div><span className="font-semibold text-gray-600">성별:</span> {info.gender}</div>
    <div><span className="font-semibold text-gray-600">입소일:</span> {info.admissionDate}</div>
    <div><span className="font-semibold text-gray-600">퇴소일:</span> {info.dischargeDate || '해당없음'}</div>
    <div className="col-span-2 md:col-span-1"><span className="font-semibold text-gray-600">평가기간:</span> {info.evaluationPeriod}</div>
    <div className="col-span-2"><span className="font-semibold text-gray-600">시설명:</span> {info.facilityName}</div>
  </div>
);

const EvaluationGrid: React.FC<{ items: EvaluationItem[] }> = ({ items }) => (
  <div className="overflow-x-auto">
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">평가지표</th>
          <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">등급</th>
          <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">사유 및 근거</th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200 text-sm">
        {items.map((item, index) => (
          <tr key={index}>
            <td className="px-4 py-3 font-medium text-gray-900">{item.metric}</td>
            <td className="px-4 py-3 text-center">
              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                item.grade === '우수' ? 'bg-green-100 text-green-800' :
                item.grade === '양호' ? 'bg-blue-100 text-blue-800' :
                item.grade === '불량' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
              }`}>{item.grade}</span>
            </td>
            <td className="px-4 py-3 text-gray-600">
              <p>{item.reason}</p>
              <p className="text-xs text-gray-400 mt-1">근거: {item.evidence}</p>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const CrossCheckResults: React.FC<{ results: CrossCheckResult[] }> = ({ results }) => (
    <ul className="space-y-3">
        {results.map((result, index) => (
            <li key={index} className="p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-md">
                <p className="font-semibold text-yellow-800">{result.item} - <span className="font-bold">{result.status}</span></p>
                <p className="text-sm text-yellow-700 mt-1">{result.recommendation}</p>
            </li>
        ))}
    </ul>
);

const GradeDistributionChart: React.FC<{ items: EvaluationItem[] }> = ({ items }) => {
  const gradeCounts = items.reduce((acc, item) => {
    const grade = item.grade || '자료 누락';
    acc[grade] = (acc[grade] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const data = [
    { name: '우수', count: gradeCounts['우수'] || 0, fill: '#4ade80' },
    { name: '양호', count: gradeCounts['양호'] || 0, fill: '#60a5fa' },
    { name: '불량', count: gradeCounts['불량'] || 0, fill: '#f87171' },
    { name: '해당없음', count: gradeCounts['해당없음'] || 0, fill: '#9ca3af' },
    { name: '자료 누락', count: gradeCounts['자료 누락'] || 0, fill: '#e5e7eb' },
  ];

  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Legend />
          <Bar dataKey="count" name="항목 수" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

const AISummary: React.FC<{ summary: string }> = ({ summary }) => (
    <div 
      className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap" 
      dangerouslySetInnerHTML={{ __html: summary.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-blue-700">$1</strong>') }}
    />
);

const ReportQnA: React.FC<{ reportData: ReportData }> = ({ reportData }) => {
    const [messages, setMessages] = React.useState<ChatMessage[]>([]);
    const [input, setInput] = React.useState('');
    const [isLoading, setIsLoading] = React.useState(false);
    const messagesEndRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        startChat(reportData);
        setMessages([{ role: 'model', text: '안녕하세요! 생성된 2026년 기준 보고서에 대해 궁금한 점을 질문해주세요.' }]);
    }, [reportData]);
    
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;
        
        const userMessage: ChatMessage = { role: 'user', text: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        const aiResponse = await askQuestion(input);
        const modelMessage: ChatMessage = { role: 'model', text: aiResponse };
        
        setMessages(prev => [...prev, modelMessage]);
        setIsLoading(false);
    };

    return (
        <div>
            <div className="h-80 bg-gray-50 rounded-lg p-4 overflow-y-auto space-y-4 border">
                {messages.map((msg, index) => (
                    <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-xs md:max-w-md lg:max-w-lg px-4 py-2 rounded-xl ${msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'}`}>
                            <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex justify-start">
                         <div className="px-4 py-2 rounded-xl bg-gray-200 text-gray-800">
                           <div className="flex items-center space-x-2">
                               <div className="w-2 h-2 rounded-full bg-gray-500 animate-bounce"></div>
                               <div className="w-2 h-2 rounded-full bg-gray-500 animate-bounce [animation-delay:-.3s]"></div>
                               <div className="w-2 h-2 rounded-full bg-gray-500 animate-bounce [animation-delay:-.5s]"></div>
                           </div>
                         </div>
                    </div>
                )}
                 <div ref={messagesEndRef} />
            </div>
            <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="여기에 질문을 입력하세요..."
                    className="flex-grow p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    disabled={isLoading}
                />
                <button type="submit" disabled={isLoading} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400">
                    전송
                </button>
            </form>
        </div>
    );
};


const ReportView: React.FC<{ reportData: ReportData; onReset: () => void }> = ({ reportData, onReset }) => {
  return (
    <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-6 print:hidden">
            <h2 className="text-3xl font-bold text-gray-900">2026년 장기요양 평가 AI 분석 보고서 (주간보호)</h2>
            <div className="flex items-center gap-2">
                 <button
                    onClick={() => window.print()}
                    className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors"
                    >
                    인쇄하기
                </button>
                <button
                  onClick={onReset}
                  className="px-4 py-2 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 transition-colors"
                >
                  새로운 분석 시작하기
                </button>
            </div>
        </div>
      
      <ReportSection title="기본 정보">
        <BasicInfoCard info={reportData.basicInfo} />
      </ReportSection>

      <ReportSection title="AI 분석 요약">
        <AISummary summary={reportData.aiSummary} />
      </ReportSection>

      <ReportSection title="세부 평가지표별 등급">
        <EvaluationGrid items={reportData.evaluationItems} />
      </ReportSection>
      
      <ReportSection title="법령/지침 기반 교차점검 결과">
        <CrossCheckResults results={reportData.crossCheckResults} />
      </ReportSection>

      <ReportSection title="등급 분포 시각화">
        <GradeDistributionChart items={reportData.evaluationItems} />
      </ReportSection>

      <div className="print:hidden">
        <ReportSection title="보고서 질의응답 (AI Chat)">
          <ReportQnA reportData={reportData} />
        </ReportSection>
      </div>
      
       <ReportSection title="첨부/참고자료">
            <div className="text-sm text-gray-600">
                <p>본 보고서는 다음의 법령 및 고시에 근거하여 평가되었습니다. 자세한 내용은 링크를 통해 확인하세요.</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>노인장기요양보험법 (제54조 등)</li>
                    <li>2026년 장기요양기관 재가급여 (주간보호) 평가 매뉴얼</li>
                    <li>장기요양급여 제공기준 및 급여비용 산정방법 등에 관한 고시</li>
                </ul>
            </div>
       </ReportSection>

    </div>
  );
};

export default ReportView;