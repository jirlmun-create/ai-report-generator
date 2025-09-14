import React from 'react';

interface ProcessingViewProps {
    progress: number;
    message: string;
}

const ProcessingView: React.FC<ProcessingViewProps> = ({ progress, message }) => {
    return (
        <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-2xl mx-auto border border-gray-200 text-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">AI 분석 중...</h2>
            <p className="text-gray-600 mb-8">업로드된 파일을 기반으로 보고서를 생성하고 있습니다. 잠시만 기다려주세요.</p>

            <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
                <div
                    className="bg-blue-600 h-4 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${progress}%` }}
                ></div>
            </div>
            <p className="text-sm font-semibold text-gray-700 mb-1">{`${Math.round(progress)}%`}</p>
            <p className="text-sm text-gray-500 h-5">{message}</p>

            <div className="mt-8">
                <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500 mx-auto"></div>
            </div>
             <div className="mt-8 text-sm text-gray-500 bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold mb-2">알아두실 점</h4>
                <ul className="list-disc list-inside text-left space-y-1">
                    <li>분석은 문서의 양과 복잡성에 따라 수 분이 소요될 수 있습니다.</li>
                    <li>이 페이지를 벗어나거나 새로고침하면 분석이 중단됩니다.</li>
                    <li>AI가 생성한 내용은 사실과 다를 수 있으니 반드시 최종 검토가 필요합니다.</li>
                </ul>
            </div>
        </div>
    );
};

export default ProcessingView;
