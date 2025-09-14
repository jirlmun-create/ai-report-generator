import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { GuidelineFile } from '../types';

interface GuidelineUploadProps {
    guidelineFiles: GuidelineFile[];
    onAddFiles: (files: File[]) => void;
    onRemoveFile: (fileName: string) => void;
    onNextStep: () => void;
}

const GuidelineUpload: React.FC<GuidelineUploadProps> = ({ guidelineFiles, onAddFiles, onRemoveFile, onNextStep }) => {
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[], fileRejections: any[]) => {
    if (fileRejections.length > 0) {
        setError("지원하지 않는 파일 형식이 포함되어 있습니다.");
    } else {
        setError(null);
    }
    onAddFiles(acceptedFiles);
  }, [onAddFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    }
  });


  const handleNext = () => {
    if (guidelineFiles.length === 0) {
      setError("평가 기준 파일을 1개 이상 업로드해주세요.");
      return;
    }
    setError(null);
    onNextStep();
  };

  return (
    <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-3xl mx-auto border border-gray-200">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">1. 평가 지침 파일 업로드</h2>
        <p className="text-gray-500 mt-2">
          분석의 기준이 될 평가 매뉴얼, 지침 등 파일을 모두 업로드해주세요. (PDF, DOCX, XLSX, TXT)
        </p>
      </div>

      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <input {...getInputProps()} />
        <p className="text-gray-600">
          {isDragActive
            ? '여기에 파일을 놓으세요'
            : '파일을 드래그 앤 드롭하거나 여기를 클릭하여 추가하세요'}
        </p>
      </div>

      {guidelineFiles.length > 0 && (
        <div className="mt-6">
          <h4 className="font-semibold text-gray-700">업로드된 지침 파일:</h4>
          <ul className="list-disc list-inside mt-2 text-sm text-gray-600 space-y-1">
            {guidelineFiles.map(file => (
              <li key={file.name} className="flex justify-between items-center">
                <span>{file.name}</span>
                <button
                  onClick={() => onRemoveFile(file.name)}
                  className="text-red-500 hover:text-red-700 text-xs font-bold"
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="mt-4 text-sm text-red-600 text-center">{error}</p>}

      <div className="mt-8 text-center">
        <button
          onClick={handleNext}
          disabled={guidelineFiles.length === 0}
          className="w-full bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
        >
          다음 단계로 (분석 자료 업로드)
        </button>
      </div>
    </div>
  );
};

export default GuidelineUpload;