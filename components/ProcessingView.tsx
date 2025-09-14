import React, { useState, useEffect } from 'react';

const processingSteps = [
    "AI가 업로드된 문서를 분석하고 있습니다...",
    "평가 지침과 자료를 상호 참조하여 검토 중입니다...",
    "주요 평가지표에 대한 등급을 산출하고 있습니다...",
    "법령 및 규정 준수 여부를 교차 확인하고 있습니다...",
    "분석 요약 및 최종 보고서를 생성하는 중입니다...",
    "거의 다 되었습니다. 잠시만 기다려주세요."
];

const ProcessingView: React.FC = () => {
    const [currentStep, setCurrentStep] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentStep(prev => (prev + 1) % processingSteps.length);
        }, 4000); // Change message every 4 seconds

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-2xl mx-auto border border-gray-200 flex flex-col items-center justify-center text-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">AI 보고서 생성 중</h2>
            <div className="w-16 h-16 border-4 border-blue-500 border-dashed rounded-full animate-spin mb-6"></div>
            <p className="text-gray-600 text-lg transition-opacity duration-500">
                {processingSteps[currentStep]}
            </p>
            <p className="text-sm text-gray-500 mt-8">
                이 작업은 문서의 양과 복잡성에 따라 몇 분 정도 소요될 수 있습니다. <br />
                페이지를 벗어나지 마시고 잠시만 기다려주세요.
            </p>
        </div>
    );
};

export default ProcessingView;
