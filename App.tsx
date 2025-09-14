import React, { useState, useEffect, useCallback } from 'react';
import { AppState, GuidelineFile, ReportData } from './types';
import GuidelineUpload from './components/GuidelineUpload';
import FileUpload from './components/FileUpload';
import ProcessingView from './components/ProcessingView';
import ReportView from './components/ReportView';
import { generateReport } from './services/geminiService';
import { readFileContent } from './utils/fileReader';
import { getGuidelinesFromDB, saveGuidelinesToDB, clearGuidelinesFromDB } from './utils/db';

const App: React.FC = () => {
    const [appState, setAppState] = useState<AppState>(AppState.Idle);
    const [guidelinesSubmitted, setGuidelinesSubmitted] = useState(false);
    const [guidelineFiles, setGuidelineFiles] = useState<GuidelineFile[]>([]);
    const [reportData, setReportData] = useState<ReportData | null>(null);
    const [error, setError] = useState<string | null>(null);

    // For processing view
    const [progress, setProgress] = useState(0);
    const [progressMessage, setProgressMessage] = useState('');

    // Load guidelines from IndexedDB on initial render
    useEffect(() => {
        const loadGuidelines = async () => {
            try {
                const storedFiles = await getGuidelinesFromDB();
                if (storedFiles.length > 0) {
                    setGuidelineFiles(storedFiles);
                    setGuidelinesSubmitted(true);
                }
            } catch (err) {
                console.error("Failed to load guidelines from DB", err);
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
            setGuidelineFiles(prevFiles => {
                const existingNames = new Set(prevFiles.map(f => f.name));
                const uniqueNewFiles = newFiles.filter(f => !existingNames.has(f.name));
                const updatedFiles = [...prevFiles, ...uniqueNewFiles];
                saveGuidelinesToDB(updatedFiles); // Persist to DB
                return updatedFiles;
            });
        } catch (e) {
            setError("파일을 읽는 중 오류가 발생했습니다.");
            console.error(e);
        }
    }, []);

    const handleRemoveGuidelineFile = useCallback((fileName: string) => {
        setGuidelineFiles(prevFiles => {
            const updatedFiles = prevFiles.filter(f => f.name !== fileName);
            saveGuidelinesToDB(updatedFiles); // Update DB
            return updatedFiles;
        });
    }, []);

    const handleNextStep = () => {
        if (guidelineFiles.length > 0) {
            setGuidelinesSubmitted(true);
        }
    };

    const handleChangeGuidelines = () => {
        setGuidelinesSubmitted(false);
    };

    const handleAnalysisSubmit = async (evaluationFiles: GuidelineFile[]) => {
        setAppState(AppState.Processing);
        setError(null);
        setReportData(null);
        setProgress(0);
        setProgressMessage('Initializing analysis...');

        const onProgress = (prog: number, msg: string) => {
            setProgress(prog);
            setProgressMessage(msg);
        };
        
        try {
            const data = await generateReport(guidelineFiles, evaluationFiles, onProgress);
            setReportData(data);
            setAppState(AppState.Report);
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'An unknown error occurred during analysis.');
            setAppState(AppState.Error);
        }
    };

    const handleFullReset = async () => {
        await clearGuidelinesFromDB();
        setGuidelineFiles([]);
        setReportData(null);
        setError(null);
        setProgress(0);
        setProgressMessage('');
        setGuidelinesSubmitted(false);
        setAppState(AppState.Idle);
    }

    const renderContent = () => {
        switch (appState) {
            case AppState.Idle:
                return guidelinesSubmitted ? (
                    <FileUpload
                        guidelineFiles={guidelineFiles}
                        onAnalysisSubmit={handleAnalysisSubmit}
                        onChangeGuidelines={handleChangeGuidelines}
                    />
                ) : (
                    <GuidelineUpload
                        guidelineFiles={guidelineFiles}
                        onAddFiles={handleAddGuidelineFiles}
                        onRemoveFile={handleRemoveGuidelineFile}
                        onNextStep={handleNextStep}
                    />
                );
            case AppState.Processing:
                return <ProcessingView progress={progress} message={progressMessage} />;
            case AppState.Report:
                if (!reportData) {
                    return (
                        <div className="text-center text-red-500">
                            <h2>Error</h2>
                            <p>Report data is missing. Please start over.</p>
                            <button onClick={handleFullReset} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded">Start Over</button>
                        </div>
                    );
                }
                return <ReportView reportData={reportData} onReset={handleFullReset} />;
            case AppState.Error:
                return (
                    <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-2xl mx-auto border border-red-300 text-center">
                        <h2 className="text-2xl font-bold text-red-600 mb-4">Analysis Failed</h2>
                        <p className="text-gray-700 mb-6">{error || 'An unexpected error occurred.'}</p>
                        <button
                            onClick={handleFullReset}
                            className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700"
                        >
                            Try Again
                        </button>
                    </div>
                );
            default:
                return <div>Invalid state</div>;
        }
    };

    return (
        <div className="bg-gray-50 min-h-screen p-4 sm:p-8 font-sans">
            <header className="max-w-5xl mx-auto mb-8 text-center">
                <h1 className="text-4xl font-extrabold text-gray-800 tracking-tight">AI 장기요양 평가 보고서 생성기</h1>
                <p className="mt-2 text-lg text-gray-500">주간보호센터 2026년 평가 대비</p>
            </header>
            <main>
                {renderContent()}
            </main>
            <footer className="max-w-5xl mx-auto mt-12 text-center text-xs text-gray-400">
                <p>&copy; {new Date().getFullYear()}. For demonstration purposes only. Verify all AI-generated content.</p>
            </footer>
        </div>
    );
};

export default App;
