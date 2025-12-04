import React from 'react';
import { ProcessedImage, ProcessStatus } from '../types';

interface ResultCardProps {
  item: ProcessedImage;
  onRetry: (id: string, part: 1 | 2) => void;
  onRemove: (id: string) => void;
}

const ImagePart: React.FC<{
  label: string;
  url: string | null;
  expandedUrl: string | null;
  status: ProcessStatus;
  onRetry: () => void;
}> = ({ label, url, expandedUrl, status, onRetry }) => {
  return (
    <div className="flex flex-col gap-3 flex-1 min-w-[140px]">
      <div className="flex items-center justify-between">
         <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">
            {label}
        </span>
        {status === ProcessStatus.Done && (
            <span className="text-[10px] text-emerald-400 font-medium px-1.5 py-0.5 bg-emerald-500/10 rounded">完成</span>
        )}
      </div>
     
      <div className="relative aspect-[3/4] bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 group shadow-inner">
        {/* Loading Overlay */}
        {status === ProcessStatus.Expanding && (
          <div className="absolute inset-0 flex flex-col gap-3 items-center justify-center bg-black/60 backdrop-blur-sm z-20">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs text-indigo-300 animate-pulse">AI 扩图中...</span>
          </div>
        )}
        
        {/* Error Overlay */}
        {status === ProcessStatus.Error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 z-20 p-2 text-center backdrop-blur-sm">
            <span className="text-red-400 text-xs mb-3 font-medium">生成失败</span>
            <button 
                onClick={onRetry}
                className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-xs rounded text-white transition border border-zinc-600"
            >
                重试
            </button>
          </div>
        )}

        {/* Content */}
        {expandedUrl ? (
          <img
            src={expandedUrl}
            alt={`${label} expanded`}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : url ? (
            // Show the raw crop if expanded version isn't ready
          <img
            src={url}
            alt={`${label} crop`}
            className="w-full h-full object-contain p-4 opacity-40 grayscale"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-700 text-xs">
            等待处理...
          </div>
        )}
        
        {/* Download Button */}
        {expandedUrl && (
             <a 
             href={expandedUrl} 
             download={`expanded-${label}-${Date.now()}.png`}
             className="absolute bottom-3 right-3 bg-white/90 hover:bg-white text-zinc-900 p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-lg translate-y-2 group-hover:translate-y-0"
             title="下载图片"
           >
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
               <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M7.5 12l4.5 4.5m0 0l4.5-4.5M12 15V3" />
             </svg>
           </a>
        )}
      </div>
    </div>
  );
};

const ResultCard: React.FC<ResultCardProps> = ({ item, onRetry, onRemove }) => {
  return (
    <div className="glass-panel rounded-2xl p-5 hover:border-zinc-700/80 transition-colors">
      <div className="mb-4 flex justify-between items-center">
        <h3 className="text-sm font-medium text-zinc-300 truncate max-w-[180px]" title={item.file.name}>
          {item.file.name}
        </h3>
        <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-500 bg-zinc-900/80 px-2 py-1 rounded border border-zinc-800">
                原始比例: 3:4
            </span>
            <button
                onClick={() => onRemove(item.id)}
                className="p-1.5 rounded-full bg-zinc-800/50 hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-all border border-transparent hover:border-red-500/30"
                title="删除"
            >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
            </button>
        </div>
      </div>

      <div className="flex flex-row gap-5">
        {/* Original Thumbnail */}
        <div className="w-24 flex-shrink-0 flex flex-col gap-3">
           <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest pl-1">
             原图预览
           </span>
           <div className="aspect-[3/4] bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800/50 opacity-80">
                <img src={item.originalUrl} className="w-full h-full object-cover" alt="Original" />
           </div>
        </div>

        {/* Divider */}
        <div className="w-px bg-zinc-800 my-2"></div>

        {/* Results */}
        <div className="flex flex-1 gap-4 overflow-x-auto">
          <ImagePart 
            label="图一 (扩图)" 
            url={item.splitPart1.url} 
            expandedUrl={item.splitPart1.expandedUrl}
            status={item.splitPart1.status}
            onRetry={() => onRetry(item.id, 1)}
          />
          <ImagePart 
            label="图二 (扩图)" 
            url={item.splitPart2.url} 
            expandedUrl={item.splitPart2.expandedUrl}
            status={item.splitPart2.status}
            onRetry={() => onRetry(item.id, 2)}
          />
        </div>
      </div>
    </div>
  );
};

export default ResultCard;