import React from 'react';

interface ProcessingViewProps {
    statusMessage: string;
}

const ProcessingView: React.FC<ProcessingViewProps> = ({ statusMessage }) => {
    return (
        <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-2xl mx-auto border border-gray-200 flex flex-col items-center justify-center text-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">AI 분석 중...</h2>
            <p className="text-gray-600 mb-6">
                업로드된 문서를 기반으로 보고서를 생성하고 있습니다. <br />
                이 작업은 문서의 양에 따라 몇 분 정도 소요될 수 있습니다. 잠시만 기다려주세요.
            </p>
            
            <div className="w-16 h-16 border-4 border-blue-500 border-dashed rounded-full animate-spin"></div>

            <div className="mt-6 w-full bg-gray-100 rounded-lg p-3 text-sm text-gray-700">
                <p>{statusMessage}</p>
            </div>

            <div className="mt-8 text-xs text-gray-400">
                <p>💡 Tip: 분석이 완료되면 결과가 자동으로 표시됩니다. 이 페이지를 벗어나지 마세요.</p>
            </div>
        </div>
    );
};

export default ProcessingView;
