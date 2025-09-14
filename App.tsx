import React, { useState, useEffect, useCallback } from 'react';
import GuidelineUpload from './components/GuidelineUpload';
import FileUpload from './components/FileUpload';
import ProcessingView from './components/ProcessingView';
import ReportView from './components/ReportView';
import { GuidelineFile, ReportData } from './types';
import { readFileContent } from './utils/fileReader';
import { generateReport } from './services/geminiService';
import { getGuidelinesFromDB, saveGuidelinesToDB, clearGuidelinesFromDB } from './utils/db';

const App: React.FC = () => {
    const [view, setView] = useState<'guideline' | 'evaluation' | 'processing' | 'report' | 'error'>('guideline');
    const [guidelineFiles, setGuidelineFiles] = useState<GuidelineFile[]>([]);
    const [reportData, setReportData] = useState<ReportData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        getGuidelinesFromDB()
            .then(files => {
                if (files.length > 0) {
                    setGuidelineFiles(files);
                    setView('evaluation');
                } else {
                    setView('guideline');
                }
            })
            .catch(err => {
                console.error("Failed to load guidelines from DB:", err);
                setView('guideline');
            })
            .finally(() => setIsLoading(false));
    }, []);

    const handleAddGuidelineFiles = useCallback(async (files: File[]) => {
        try {
            const newFiles = await Promise.all(
                files.map(async file => ({
                    name: file.name,
                    content: await readFileContent(file)
                }))
            );
            setGuidelineFiles(prevFiles => {
                const uniqueFiles = [...prevFiles];
                newFiles.forEach(nf => {
                    if (!uniqueFiles.some(uf => uf.name === nf.name)) {
                        uniqueFiles.push(nf);
                    }
                });
                saveGuidelinesToDB(uniqueFiles);
                return uniqueFiles;
            });
        } catch (e) {
            setError("파일을 읽는 중 오류가 발생했습니다.");
            console.error(e);
        }
    }, []);
    
    const handleRemoveGuidelineFile = (fileName: string) => {
        setGuidelineFiles(prevFiles => {
            const updatedFiles = prevFiles.filter(f => f.name !== fileName);
            saveGuidelinesToDB(updatedFiles);
            return updatedFiles;
        });
    };
    
    const handleNextFromGuidelines = () => {
        if (guidelineFiles.length > 0) {
            setView('evaluation');
        }
    };

    const handleAnalysisSubmit = async (evaluationFiles: GuidelineFile[]) => {
        setView('processing');
        setError(null);
        try {
            const data = await generateReport(guidelineFiles, evaluationFiles);
            setReportData(data);
            setView('report');
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : "알 수 없는 오류가 발생했습니다.";
            setError(errorMessage);
            setView('error');
        }
    };

    const handleReset = () => {
        clearGuidelinesFromDB().then(() => {
            setGuidelineFiles([]);
            setReportData(null);
            setError(null);
            setView('guideline');
        });
    };
    
    const handleChangeGuidelines = () => {
        setView('guideline');
    };

    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="flex justify-center items-center h-screen">
                    <div className="text-center p-8">
                        <p className="text-lg text-gray-600">설정 정보를 불러오는 중...</p>
                    </div>
                </div>
            );
        }

        switch (view) {
            case 'guideline':
                return <GuidelineUpload
                            guidelineFiles={guidelineFiles}
                            onAddFiles={handleAddGuidelineFiles}
                            onRemoveFile={handleRemoveGuidelineFile}
                            onNextStep={handleNextFromGuidelines}
                        />;
            case 'evaluation':
                return <FileUpload
                            guidelineFiles={guidelineFiles}
                            onAnalysisSubmit={handleAnalysisSubmit}
                            onChangeGuidelines={handleChangeGuidelines}
                        />;
            case 'processing':
                return <ProcessingView />;
            case 'report':
                // FIX: Check for reportData before rendering ReportView to prevent rendering with null data.
                return reportData ? <ReportView reportData={reportData} onReset={handleReset} /> : null;
            case 'error':
                 return (
                    <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-2xl mx-auto border border-red-300 text-center">
                        <h2 className="text-2xl font-bold text-red-700 mb-4">오류 발생</h2>
                        <p className="text-red-600 bg-red-50 p-4 rounded-md mb-6">{error}</p>
                        <button
                            onClick={handleReset}
                            className="w-full bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            새로운 분석 시작하기
                        </button>
                    </div>
                );
            default:
                return <div>잘못된 애플리케이션 상태입니다.</div>;
        }
    };

    return (
        <div className="bg-gray-50 min-h-screen py-10 px-4 sm:px-6 lg:px-8 font-sans">
            <header className="max-w-5xl mx-auto mb-8 text-center">
                <h1 className="text-4xl font-extrabold text-gray-800 tracking-tight">
                    AI 장기요양 평가 보고서 생성기
                </h1>
                <p className="mt-3 text-lg text-gray-500">
                    평가 지침과 관련 서류를 업로드하여 AI 분석 보고서를 자동으로 생성하세요.
                </p>
            </header>
            <main>
                {renderContent()}
            </main>
            <footer className="text-center mt-12 text-sm text-gray-500">
                <p>&copy; {new Date().getFullYear()} AI Report Generator. All rights reserved.</p>
            </footer>
        </div>
    );
};

export default App;
