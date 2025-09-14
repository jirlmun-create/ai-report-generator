
import React, { useState, useEffect } from 'react';

const steps = [
  "문서 형식 감지 중...",
  "다양한 포맷 문서 파싱...",
  "데이터 표준화 및 전처리...",
  "AI 모델 로딩 및 초기화...",
  "평가 기준에 따른 내용 분석...",
  "데이터 교차 점검 및 오류 검출...",
  "평가 등급 산정 및 요약 생성...",
  "시각화 자료 준비 중...",
  "최종 보고서 생성 중...",
];

const ProcessingView: React.FC = () => {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const progressInterval = setInterval(() => {
      setProgress(prev => (prev >= 100 ? 100 : prev + 2));
    }, 400);

    const stepInterval = setInterval(() => {
      setCurrentStep(prev => (prev >= steps.length - 1 ? prev : prev + 1));
    }, 2000);

    return () => {
      clearInterval(progressInterval);
      clearInterval(stepInterval);
    };
  }, []);

  return (
    <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-3xl mx-auto border border-gray-200">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">보고서 생성 중</h2>
        <p className="text-gray-500 mb-8">AI가 문서를 분석하고 있습니다. 잠시만 기다려 주세요.</p>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-4 mb-4 overflow-hidden">
        <div 
          className="bg-blue-600 h-4 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
      <div className="text-center text-blue-800 font-medium">
        <p>{steps[currentStep]}</p>
      </div>
    </div>
  );
};

export default ProcessingView;
