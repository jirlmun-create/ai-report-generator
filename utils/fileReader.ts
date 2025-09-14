import * as pdfjs from 'pdfjs-dist';
import mammoth from 'mammoth';
import * as xlsx from 'xlsx';

// Set worker path for pdfjs from CDN to ensure it works in the environment.
pdfjs.GlobalWorkerOptions.workerSrc = `https://aistudiocdn.com/pdfjs-dist@4.5.136/build/pdf.worker.min.mjs`;

const readTextFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            if (event.target && typeof event.target.result === 'string') {
                resolve(event.target.result);
            } else {
                reject(new Error("Failed to read text file."));
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsText(file);
    });
};

const readPdfFile = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument(arrayBuffer).promise;
    let textContent = '';
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        // Ensure item.str is checked for existence before joining
        textContent += content.items.map(item => 'str' in item ? item.str : '').join(' ');
        textContent += '\n\n'; // Add space between pages
    }
    return textContent;
};

const readDocxFile = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
};

const readXlsxFile = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = xlsx.read(arrayBuffer, { type: 'array' });
    let fullText = '';
    workbook.SheetNames.forEach(sheetName => {
        fullText += `--- Sheet: ${sheetName} ---\n`;
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = xlsx.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
        jsonData.forEach(row => {
            fullText += row.join('\t') + '\n';
        });
        fullText += '\n';
    });
    return fullText;
};


export const readFileContent = async (file: File): Promise<string> => {
    const fileType = file.type;
    const extension = file.name.split('.').pop()?.toLowerCase();

    if (fileType === 'application/pdf' || extension === 'pdf') {
        return readPdfFile(file);
    }
    if (fileType === 'text/plain' || extension === 'txt') {
        return readTextFile(file);
    }
    if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || extension === 'docx') {
        return readDocxFile(file);
    }
    if (fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || extension === 'xlsx') {
        return readXlsxFile(file);
    }
    // For unsupported files like .hwp or .xls, return a message instead of trying to read
    return Promise.resolve(`[파일 형식 분석 불가: ${file.name}] 이 파일의 내용은 분석할 수 없지만, 제출 사실은 AI에 의해 인지됩니다.`);
};
