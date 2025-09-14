import { GuidelineFile } from '../types';

const DB_NAME = 'GuidelineDB';
const STORE_NAME = 'guidelines';
const DB_VERSION = 1;

let db: IDBDatabase;

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) {
      return resolve(db);
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Database error:', request.error);
      reject('Database error: ' + request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const dbInstance = (event.target as IDBOpenDBRequest).result;
      if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
        dbInstance.createObjectStore(STORE_NAME, { keyPath: 'name' });
      }
    };
  });
};

export const saveGuidelinesToDB = async (files: GuidelineFile[]): Promise<void> => {
  const dbInstance = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = dbInstance.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    // Clear existing data first
    const clearRequest = store.clear();
    
    clearRequest.onerror = () => {
        reject(transaction.error || 'Failed to clear store');
    }

    clearRequest.onsuccess = () => {
        // Then add new files, handle potential constraint errors if names are not unique
        if (files.length === 0) {
            return; // Nothing to add
        }
        files.forEach((file, index) => {
            const putRequest = store.put(file);
            if (index === files.length - 1) { // Last item
                putRequest.onsuccess = () => {
                    // This is handled by transaction.oncomplete
                };
            }
        });
    };

    transaction.oncomplete = () => {
      resolve();
    };
    transaction.onerror = () => {
      reject(transaction.error || 'Transaction failed');
    };
  });
};

export const getGuidelinesFromDB = async (): Promise<GuidelineFile[]> => {
  const dbInstance = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = dbInstance.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error);
    };
  });
};

export const clearGuidelinesFromDB = async (): Promise<void> => {
    const dbInstance = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = dbInstance.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();
        
        request.onsuccess = () => {
            resolve();
        };
        request.onerror = () => {
            reject(request.error);
        };
    });
};
