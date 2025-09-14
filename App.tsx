import React, { useState, useEffect, useCallback } from 'react';
import { AppState, GuidelineFile, ReportData } from './types';
import { readFileContent } from './utils/fileReader';
import { getGuidelinesFromDB, saveGuidelinesToDB, clearGuidelinesFromDB } from './utils/db';
import { analyzeDocuments } from './services/geminiService';

import GuidelineUpload from './components/GuidelineUpload';
import FileUpload from './components/FileUpload';
import ProcessingView from './components/ProcessingView';
import ReportView from './components/ReportView';

const App: React.FC = () => {
    const [appState, setAppState] = useState<AppState>(AppState.Idle);
    const [guidelineFiles, setGuidelineFiles] = useState<GuidelineFile[]>([]);
    const [reportData, setReportData] = useState<ReportData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [processingStatus, setProcessingStatus] = useState<string>('');
    const [currentStep, setCurrentStep] = useState<'guidelines' | 'evaluation'>('guidelines');

    useEffect(() => {
        // Load guidelines from IndexedDB on startup
        const loadGuidelines = async () => {
            try {
                const storedFiles = await getGuidelinesFromDB();
                if (storedFiles.length > 0) {
                    setGuidelineFiles(storedFiles);
                    setCurrentStep('evaluation');
                }
            } catch (err) {
                console.error("Failed to load guidelines from DB:", err);
            }
        };
        loadGuidelines();
    }, []);

    const handleAddGuidelineFiles = useCallback(async (files: File[]) => {
        try {
            const newFiles = await Promise.all(
                files.map(async file => ({
                    name: file.name,
                    content: await readFileContent(file)
                }))
            );
            setGuidelineFiles(prev => {
                const uniqueNewFiles = newFiles.filter(nf => !prev.some(pf => pf.name === nf.name));
                return [...prev, ...uniqueNewFiles];
            });
        } catch (e) {
            setError("파일을 읽는 중 오류가 발생했습니다.");
            console.error(e);
        }
    }, []);

    const handleRemoveGuidelineFile = useCallback((fileName: string) => {
        setGuidelineFiles(prev => prev.filter(f => f.name !== fileName));
    }, []);

    const handleNextStep = async () => {
        if (guidelineFiles.length > 0) {
            await saveGuidelinesToDB(guidelineFiles);
            setCurrentStep('evaluation');
        }
    };

    const handleChangeGuidelines = async () => {
        await clearGuidelinesFromDB();
        setGuidelineFiles([]);
        setCurrentStep('guidelines');
    };

    const handleAnalysisSubmit = async (evaluationFiles: GuidelineFile[]) => {
        setError(null);
        setAppState(AppState.Processing);
        setProcessingStatus("분석을 준비하고 있습니다...");
        try {
            const result = await analyzeDocuments(guidelineFiles, evaluationFiles, setProcessingStatus);
            setReportData(result);
            setAppState(AppState.Report);
        } catch (err) {
            console.error(err);
            const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
            setError(errorMessage);
            setAppState(AppState.Error);
        }
    };
    
    const handleReset = () => {
        setAppState(AppState.Idle);
        setReportData(null);
        setError(null);
        // We keep the guidelines loaded for convenience
        setCurrentStep('evaluation'); 
    };

    const renderContent = () => {
        if (appState === AppState.Error) {
            return (
                <div className="text-center p-8 bg-white rounded-xl shadow-lg border border-red-300">
                    <h2 className="text-2xl font-bold text-red-700 mb-4">오류 발생</h2>
                    <p className="text-red-600 mb-6">{error}</p>
                    <button
                        onClick={handleReset}
                        className="px-6 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors"
                    >
                        다시 시도하기
                    </button>
                </div>
            );
        }

        if (appState === AppState.Processing) {
            return <ProcessingView statusMessage={processingStatus} />;
        }

        if (appState === AppState.Report && reportData) {
            return <ReportView reportData={reportData} onReset={handleReset} />;
        }

        // Idle state
        if (currentStep === 'guidelines') {
             return (
                <GuidelineUpload
                    guidelineFiles={guidelineFiles}
                    onAddFiles={handleAddGuidelineFiles}
                    onRemoveFile={handleRemoveGuidelineFile}
                    onNextStep={handleNextStep}
                />
             );
        }

        if (currentStep === 'evaluation') {
            return (
                <FileUpload 
                    guidelineFiles={guidelineFiles}
                    onAnalysisSubmit={handleAnalysisSubmit}
                    onChangeGuidelines={handleChangeGuidelines}
                />
            );
        }
        
        return null; // Should not happen
    };

    return (
        <div className="bg-gray-50 min-h-screen font-sans">
            <header className="bg-white shadow-sm print:hidden">
                <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        AI 장기요양 평가 보고서 생성기
                    </h1>
                </div>
            </header>
            <main className="py-10">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
                    {renderContent()}
                </div>
            </main>
            <footer className="text-center py-4 text-sm text-gray-500 print:hidden">
                <p>&copy; 2024 AI Report Generator. All rights reserved.</p>
            </footer>
        </div>
    );
};

export default App;
