import React, { useCallback, useState, useRef } from 'react';

interface DropzoneProps {
  onFilesAdded: (files: File[]) => void;
  isProcessing: boolean;
}

// Helper to reliably read all entries from a directory reader
// FileSystemDirectoryReader.readEntries may not return all entries in a single call.
const readAllEntries = async (dirReader: any): Promise<any[]> => {
  let entries: any[] = [];
  let keepReading = true;

  while (keepReading) {
    const batch = await new Promise<any[]>((resolve, reject) => {
      dirReader.readEntries(
        (results: any[]) => resolve(results),
        (err: any) => reject(err)
      );
    });

    if (batch.length > 0) {
      entries = entries.concat(batch);
    } else {
      keepReading = false;
    }
  }
  return entries;
};

// Recursive folder scanning
const traverseFileTree = async (item: any, path = ''): Promise<File[]> => {
  if (item.isFile) {
    return new Promise((resolve) => {
      item.file((file: File) => {
        // Only accept images
        if (file.type.startsWith('image/')) {
           resolve([file]);
        } else {
           resolve([]);
        }
      });
    });
  } else if (item.isDirectory) {
    const dirReader = item.createReader();
    try {
        const entries = await readAllEntries(dirReader);
        const entriesPromises = entries.map((entry) => traverseFileTree(entry, path + item.name + '/'));
        const filesArrays = await Promise.all(entriesPromises);
        return filesArrays.flat();
    } catch (e) {
        console.warn("Failed to read directory", item.name, e);
        return [];
    }
  }
  return [];
};

const Dropzone: React.FC<DropzoneProps> = ({ onFilesAdded, isProcessing }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!isProcessing) setIsDragging(true);
  }, [isProcessing]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (isProcessing) return;

      const items = e.dataTransfer.items;
      const files: File[] = [];

      if (items) {
        // Use DataTransferItemList interface to access the file(s)
        const entriesPromises: Promise<File[]>[] = [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i].webkitGetAsEntry();
            if (item) {
                entriesPromises.push(traverseFileTree(item));
            }
        }
        const filesArrays = await Promise.all(entriesPromises);
        // Explicitly cast to avoid inference issues with flat()
        files.push(...(filesArrays.flat() as File[]));
      } else {
        // Fallback for older browsers
        // Explicitly cast the result to File[] to fix the "Argument of type 'unknown' is not assignable to parameter of type 'File'" error
        const droppedFiles = Array.from(e.dataTransfer.files).filter((file: File) =>
            file.type.startsWith('image/')
        ) as File[];
        files.push(...droppedFiles);
      }

      if (files.length > 0) {
        onFilesAdded(files);
      }
    },
    [onFilesAdded, isProcessing]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && !isProcessing) {
      const files = Array.from(e.target.files).filter((file: File) =>
        file.type.startsWith('image/')
      );
      onFilesAdded(files);
    }
    // Reset value so same file can be selected again
    if(e.target) e.target.value = '';
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        relative group border border-dashed rounded-2xl p-10 text-center transition-all duration-500 overflow-hidden
        ${
          isDragging
            ? 'border-indigo-500 bg-indigo-500/10 scale-[1.01] shadow-[0_0_30px_rgba(99,102,241,0.2)]'
            : 'border-zinc-700 hover:border-zinc-500 bg-zinc-900/40 hover:bg-zinc-800/60'
        }
        ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
        {/* Background Glow Effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

      {/* Hidden Inputs */}
      <input
        type="file"
        ref={fileInputRef}
        multiple
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={isProcessing}
      />
      
      {/* 
        React doesn't fully support webkitdirectory as a boolean attribute in TS types nicely yet. 
        We use a specific ref and props spread or just simple ignore for the specific attribute warning if strictly typed,
        but functionally specific input for folder is cleaner.
      */}
      <input
        type="file"
        ref={folderInputRef}
        // @ts-ignore
        webkitdirectory=""
        directory=""
        multiple
        onChange={handleFileSelect}
        className="hidden"
        disabled={isProcessing}
      />

      <div className="relative z-10 flex flex-col items-center gap-5">
        <div className={`
            p-4 rounded-full bg-zinc-800/80 ring-1 ring-white/10 shadow-xl
            group-hover:scale-110 group-hover:rotate-3 transition-all duration-500
        `}>
             <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-8 h-8 text-indigo-400"
            >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
            />
            </svg>
        </div>
       
        <div className="space-y-1">
            <p className="text-xl font-medium text-zinc-100 tracking-wide">
            拖拽图片或文件夹至此
            </p>
            <p className="text-sm text-zinc-500">
            支持 JPG, PNG, WEBP 格式
            </p>
        </div>

        <div className="flex flex-wrap justify-center gap-3 mt-2">
            <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="px-5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium transition-colors border border-zinc-700"
            >
                选择图片
            </button>
            <button
                type="button"
                onClick={() => folderInputRef.current?.click()}
                disabled={isProcessing}
                className="px-5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium transition-colors border border-zinc-700"
            >
                选择文件夹
            </button>
        </div>
      </div>
    </div>
  );
};

export default Dropzone;