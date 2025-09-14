import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { GuidelineFile } from '../types';
import { readFileContent } from '../utils/fileReader';

interface FileUploadProps {
    guidelineFiles: GuidelineFile[];
    onAnalysisSubmit: (evaluationFiles: GuidelineFile[]) => void;
    onChangeGuidelines: () => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ guidelineFiles, onAnalysisSubmit, onChangeGuidelines }) => {
    const [evaluationFiles, setEvaluationFiles] = useState<GuidelineFile[]>([]);
    const [error, setError] = useState<string | null>(null);

    const onDrop = useCallback(async (acceptedFiles: File[], fileRejections: any[]) => {
        if (fileRejections.length > 0) {
            setError("지원하지 않는 파일 형식이 포함되어 있습니다.");
        } else {
            setError(null);
        }

        try {
            const newEvaluationFileContents = await Promise.all(
                acceptedFiles.map(async file => ({
                    name: file.name,
                    content: await readFileContent(file)
                }))
            );
            setEvaluationFiles(prevFiles => [...prevFiles, ...newEvaluationFileContents]);
        } catch (e) {
            setError("파일을 읽는 중 오류가 발생했습니다.");
            console.error(e);
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/pdf': ['.pdf'],
            'text/plain': ['.txt'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
        }
    });

    const handleRemoveFile = (fileName: string) => {
        setEvaluationFiles(prevFiles => prevFiles.filter(f => f.name !== fileName));
    };

    const handleSubmit = () => {
        if (evaluationFiles.length === 0) {
            setError("분석할 평가 자료 파일을 1개 이상 업로드해주세요.");
            return;
        }
        setError(null);
        onAnalysisSubmit(evaluationFiles);
    };

    return (
        <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-3xl mx-auto border border-gray-200">
            <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">2. 분석 자료 업로드</h2>
                <p className="text-gray-500 mt-2">
                    평가 대상 기간의 관련 서류를 모두 업로드해주세요. (PDF, DOCX, XLSX, TXT)
                </p>
            </div>
            
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
                <h4 className="font-semibold text-gray-700 mb-2">적용된 평가 지침:</h4>
                <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                    {guidelineFiles.map(file => (
                        <li key={file.name}>
                            <span>{file.name}</span>
                        </li>
                    ))}
                </ul>
                <button
                    onClick={onChangeGuidelines}
                    className="text-sm text-blue-600 hover:underline mt-3"
                >
                    지침 파일 변경하기
                </button>
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
                        : '평가 자료 파일을 드래그 앤 드롭하거나 여기를 클릭하여 추가하세요'}
                </p>
            </div>

            {evaluationFiles.length > 0 && (
                <div className="mt-6">
                    <h4 className="font-semibold text-gray-700">업로드된 평가 자료:</h4>
                    <ul className="list-disc list-inside mt-2 text-sm text-gray-600 space-y-1">
                        {evaluationFiles.map(file => (
                            <li key={file.name} className="flex justify-between items-center">
                                <span>{file.name}</span>
                                <button
                                    onClick={() => handleRemoveFile(file.name)}
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
                    onClick={handleSubmit}
                    disabled={evaluationFiles.length === 0}
                    className="w-full bg-green-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors"
                >
                    AI 분석 시작하기
                </button>
            </div>
        </div>
    );
};

export default FileUpload;
