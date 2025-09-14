import React, { useState, useEffect } from 'react';
import { AppState, GuidelineFile, ReportData } from './types';
import GuidelineUpload from './components/GuidelineUpload';
import FileUpload from './components/FileUpload';
import ProcessingView from './components/ProcessingView';
import ReportView from './components/ReportView'; // Corrected Path
import { generateReport } from './services/geminiService';
import { readFileContent } from './utils/fileReader';
import { getGuidelinesFromDB, saveGuidelinesToDB, clearGuidelinesFromDB } from './utils/db';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.Idle);
  const [currentView, setCurrentView] = useState<'guideline' | 'evaluation'>('guideline');
  
  const [guidelineFiles, setGuidelineFiles] = useState<GuidelineFile[]>([]);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadInitialGuidelines = async () => {
      try {
        const savedFiles = await getGuidelinesFromDB();
        if (Array.isArray(savedFiles) && savedFiles.length > 0) {
            setGuidelineFiles(savedFiles);
            setCurrentView('evaluation');
        }
      } catch (e) {
        console.error("Failed to load guideline files from IndexedDB", e);
      }
    };
    loadInitialGuidelines();
  }, []);
  
  const handleAddGuidelineFiles = async (newFiles: File[]) => {
      try {
          const newGuidelineContents = await Promise.all(
              newFiles.map(async file => ({
                  name: file.name,
                  content: await readFileContent(file)
              }))
          );
          // Prevent duplicates by name
          const updatedFiles = [...guidelineFiles];
          newGuidelineContents.forEach(newFile => {
              if (!updatedFiles.some(existingFile => existingFile.name === newFile.name)) {
                  updatedFiles.push(newFile);
              }
          });
          setGuidelineFiles(updatedFiles);
          await saveGuidelinesToDB(updatedFiles); 
      } catch (e) {
           const errorMessage = e instanceof Error ? e.message : "An unknown error occurred while reading files.";
           console.error("Failed to add guideline files:", e);
           setError(`파일 추가 중 오류 발생: ${errorMessage}`);
           setAppState(AppState.Error);
      }
  };

  const handleRemoveGuidelineFile = async (fileName: string) => {
      const updatedFiles = guidelineFiles.filter(f => f.name !== fileName);
      setGuidelineFiles(updatedFiles);
      await saveGuidelinesToDB(updatedFiles);
  };
  
  const handleGoToEvaluation = () => {
      if(guidelineFiles.length > 0) {
          setCurrentView('evaluation');
      }
  };

  const handleChangeGuidelines = () => {
      setCurrentView('guideline');
  }

  const handleAnalysis = async (evaluationFiles: GuidelineFile[]) => {
    if (guidelineFiles.length === 0) {
        setError("평가 지침 파일이 없습니다. 먼저 지침 파일을 업로드해주세요.");
        setCurrentView('guideline');
        return;
    }
    setAppState(AppState.Processing);
    setError(null);
    try {
      const data = await generateReport(guidelineFiles, evaluationFiles);
      setReportData(data);
      setAppState(AppState.Report);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
      setError(errorMessage);
      setAppState(AppState.Error);
    }
  };

  const handleResetForNewAnalysis = () => {
    setReportData(null);
    setError(null);
    setAppState(AppState.Idle);
    setCurrentView('evaluation');
  };
  
  const handleResetCompletely = async () => {
    setGuidelineFiles([]);
    setReportData(null);
    setError(null);
    setAppState(AppState.Idle);
    setCurrentView('guideline');
    await clearGuidelinesFromDB();
  };


  const renderContent = () => {
    switch(appState) {
        case AppState.Processing:
            return <ProcessingView />;
        case AppState.Report:
            return reportData ? <ReportView reportData={reportData} onReset={handleResetForNewAnalysis} /> : null;
        case AppState.Error:
            return (
              <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-3xl mx-auto border border-red-300 text-center">
                <h2 className="text-2xl font-bold text-red-700 mb-4">오류 발생</h2>
                <p className="text-red-600 mb-6">{error || '알 수 없는 오류가 발생했습니다.'}</p>
                <button
                  onClick={handleResetCompletely}
                  className="bg-red-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-red-700 transition-colors"
                >
                  처음부터 다시 시작
                </button>
              </div>
            );
        case AppState.Idle:
        default:
            if (currentView === 'guideline' || guidelineFiles.length === 0) {
                return <GuidelineUpload 
                    guidelineFiles={guidelineFiles}
                    onAddFiles={handleAddGuidelineFiles}
                    onRemoveFile={handleRemoveGuidelineFile}
                    onNextStep={handleGoToEvaluation}
                />;
            } else {
                return <FileUpload 
                    guidelineFiles={guidelineFiles}
                    onAnalysisSubmit={handleAnalysis} 
                    onChangeGuidelines={handleChangeGuidelines}
                />;
            }
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen p-4 sm:p-6 lg:p-8">
      <header className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-800">AI 장기요양평가 보고서</h1>
        <p className="text-md text-gray-500 mt-2">최신 평가 지침에 따라 문서를 분석하고 상세 보고서를 생성합니다.</p>
      </header>
      <main className="w-full flex justify-center">
        <div className="w-full max-w-5xl">
         {renderContent()}
        </div>
      </main>
       <footer className="text-center mt-8 text-sm text-gray-400 print:hidden">
            <p>Powered by Google Gemini API</p>
      </footer>
    </div>
  );
};

export default App;