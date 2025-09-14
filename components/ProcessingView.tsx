import React, { useState, useEffect } from 'react';

const loadingMessages = [
    "AI 분석을 시작합니다...",
    "업로드된 평가 지침과 서류를 확인하고 있습니다.",
    "텍스트를 추출하고 주요 정보를 식별하고 있습니다.",
    "평가 지표와 문서 내용을 교차 검증하고 있습니다.",
    "항목별 등급과 사유를 생성 중입니다.",
    "법령/지침 기반 교차 점검을 수행하고 있습니다.",
    "종합적인 AI 분석 요약을 작성하고 있습니다.",
    "거의 다 됐습니다. 최종 보고서를 생성하고 있습니다.",
];

const ProcessingView: React.FC = () => {
    const [messageIndex, setMessageIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setMessageIndex(prevIndex => (prevIndex + 1) % loadingMessages.length);
        }, 3000); // Change message every 3 seconds

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-2xl mx-auto border border-gray-200 text-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">AI 보고서 생성 중</h2>
            <p className="text-gray-600 mb-8">
                업로드하신 자료를 바탕으로 AI가 분석 보고서를 만들고 있습니다. <br />
                이 과정은 몇 분 정도 소요될 수 있습니다. 잠시만 기다려주세요.
            </p>
            <div className="flex justify-center items-center space-x-2 my-6">
                <div className="w-4 h-4 rounded-full bg-blue-500 animate-bounce"></div>
                <div className="w-4 h-4 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-4 h-4 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
            </div>
            <div className="mt-8 p-4 bg-gray-50 rounded-lg h-16 flex items-center justify-center">
                <p className="text-gray-700 font-medium transition-opacity duration-500">
                    {loadingMessages[messageIndex]}
                </p>
            </div>
        </div>
    );
};

export default ProcessingView;
