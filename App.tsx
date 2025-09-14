import React, { useState, useEffect } from 'react';
import { AppState, GuidelineFile, ReportData } from './types';
import GuidelineUpload from './components/GuidelineUpload';
import FileUpload from './components/FileUpload';
import ProcessingView from './components/ProcessingView';
import ReportView from './components/ReportView';
import { generateReport } from './services/geminiService';
import { getGuidelinesFromDB, saveGuidelinesToDB, clearGuidelinesFromDB } from './utils/db';
import { readFileContent } from './utils/fileReader';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.Idle);
  const [guidelineFiles, setGuidelineFiles] = useState<GuidelineFile[]>([]);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showFileUpload, setShowFileUpload] = useState(false);

  useEffect(() => {
    // Check for saved guidelines in IndexedDB on initial load
    const loadGuidelines = async () => {
      try {
        const savedFiles = await getGuidelinesFromDB();
        if (savedFiles.length > 0) {
          setGuidelineFiles(savedFiles);
          setShowFileUpload(true); // If guidelines exist, skip to the next step
        }
      } catch (error) {
        console.error("Failed to load guidelines from DB:", error);
      }
    };
    loadGuidelines();
  }, []);

  const handleAddGuidelineFiles = async (files: File[]) => {
    try {
      const newFileContents = await Promise.all(
        files.map(async file => ({
          name: file.name,
          content: await readFileContent(file)
        }))
      );
      const updatedFiles = [...guidelineFiles, ...newFileContents];
      setGuidelineFiles(updatedFiles);
      await saveGuidelinesToDB(updatedFiles);
    } catch (e) {
      setErrorMessage("파일을 읽는 중 오류가 발생했습니다.");
      setAppState(AppState.Error);
      console.error(e);
    }
  };

  const handleRemoveGuidelineFile = async (fileName: string) => {
    const updatedFiles = guidelineFiles.filter(f => f.name !== fileName);
    setGuidelineFiles(updatedFiles);
    await saveGuidelinesToDB(updatedFiles);
  };

  const handleNextStep = () => {
    setShowFileUpload(true);
  };
  
  const handleChangeGuidelines = () => {
    setShowFileUpload(false);
  };

  const handleAnalysisSubmit = async (evaluationFiles: GuidelineFile[]) => {
    setAppState(AppState.Processing);
    try {
      const data = await generateReport(guidelineFiles, evaluationFiles);
      setReportData(data);
      setAppState(AppState.Report);
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error.message || "보고서 생성 중 알 수 없는 오류가 발생했습니다.");
      setAppState(AppState.Error);
    }
  };
  
  const handleReset = async () => {
    setAppState(AppState.Idle);
    setGuidelineFiles([]);
    setReportData(null);
    setErrorMessage('');
    setShowFileUpload(false);
    await clearGuidelinesFromDB();
  };

  const renderContent = () => {
    switch (appState) {
      case AppState.Processing:
        return <ProcessingView />;
      case AppState.Report:
        return reportData && <ReportView reportData={reportData} onReset={handleReset} />;
      case AppState.Error:
        return (
          <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-2xl mx-auto border border-red-200 text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-4">오류 발생</h2>
            <p className="text-gray-700 mb-6">{errorMessage}</p>
            <button
              onClick={handleReset}
              className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
            >
              처음으로 돌아가기
            </button>
          </div>
        );
      case AppState.Idle:
      default:
        return showFileUpload ? (
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
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen p-4 sm:p-8 flex flex-col items-center">
      <header className="text-center mb-8">
        <h1 className="text-4xl font-extrabold text-gray-800">장기요양 평가 AI 분석기</h1>
        <p className="text-gray-600 mt-2">
            2026년 주간보호 평가 기준에 따라 평가 자료를 분석하고 보고서를 생성합니다.
        </p>
      </header>
      <main className="w-full">
        {renderContent()}
      </main>
      <footer className="text-center mt-8 text-gray-500 text-sm print:hidden">
        <p>&copy; 2024 AI Report Generator. All rights reserved.</p>
        <p className="mt-1">
            본 서비스는 AI를 활용한 분석 보조 도구이며, 최종 검토 및 책임은 사용자에게 있습니다.
        </p>
      </footer>
    </div>
  );
};

export default App;
