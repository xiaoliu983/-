import React, { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Dropzone from './components/Dropzone';
import ResultCard from './components/ResultCard';
import { ProcessedImage, ProcessStatus, SplitDirection } from './types';
import { readFileAsDataURL, splitImage } from './services/imageUtils';
import { expandImageWithGemini, GeminiSettings } from './services/geminiService';

const DEFAULT_MODEL = 'gemini-2.5-flash-image';

const App: React.FC = () => {
  const [items, setItems] = useState<ProcessedImage[]>([]);
  const [splitDirection, setSplitDirection] = useState<SplitDirection>(SplitDirection.Horizontal);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<GeminiSettings>({
    apiKey: '',
    baseUrl: '',
    modelName: DEFAULT_MODEL
  });

  // Load settings from localStorage on mount
  useEffect(() => {
    const storedKey = localStorage.getItem('gemini_api_key');
    const storedBaseUrl = localStorage.getItem('gemini_base_url');
    const storedModel = localStorage.getItem('gemini_model');
    
    setSettings({
      apiKey: storedKey || '',
      baseUrl: storedBaseUrl || '',
      modelName: storedModel || DEFAULT_MODEL
    });

    // Auto-open settings if no key is found
    if (!storedKey) {
      setShowSettings(true);
    }
  }, []);

  // Save settings
  const saveSettings = (newSettings: GeminiSettings) => {
    setSettings(newSettings);
    localStorage.setItem('gemini_api_key', newSettings.apiKey);
    
    if (newSettings.baseUrl) localStorage.setItem('gemini_base_url', newSettings.baseUrl);
    else localStorage.removeItem('gemini_base_url');

    if (newSettings.modelName) localStorage.setItem('gemini_model', newSettings.modelName);
    else localStorage.removeItem('gemini_model');
    
    setShowSettings(false);
  };

  // Handle new file uploads
  const handleFilesAdded = async (files: File[]) => {
    const newItems: ProcessedImage[] = [];

    for (const file of files) {
      const originalUrl = await readFileAsDataURL(file);
      newItems.push({
        id: uuidv4(),
        originalUrl,
        file,
        splitPart1: { url: null, expandedUrl: null, status: ProcessStatus.Idle },
        splitPart2: { url: null, expandedUrl: null, status: ProcessStatus.Idle },
      });
    }

    setItems((prev) => [...newItems, ...prev]);
  };

  // Process a single part of an image
  const processImagePart = useCallback(async (
    itemId: string, 
    partNumber: 1 | 2, 
    croppedBase64: string,
    currentSettings: GeminiSettings
  ) => {
    // Update status to Expanding
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const partKey = partNumber === 1 ? 'splitPart1' : 'splitPart2';
      return {
        ...item,
        [partKey]: { ...item[partKey], status: ProcessStatus.Expanding }
      };
    }));

    try {
      const expandedBase64 = await expandImageWithGemini(croppedBase64, currentSettings);
      
      setItems(prev => prev.map(item => {
        if (item.id !== itemId) return item;
        const partKey = partNumber === 1 ? 'splitPart1' : 'splitPart2';
        return {
          ...item,
          [partKey]: { ...item[partKey], expandedUrl: expandedBase64, status: ProcessStatus.Done }
        };
      }));
    } catch (error) {
      console.error("Expansion failed", error);
      setItems(prev => prev.map(item => {
        if (item.id !== itemId) return item;
        const partKey = partNumber === 1 ? 'splitPart1' : 'splitPart2';
        return {
          ...item,
          [partKey]: { ...item[partKey], status: ProcessStatus.Error }
        };
      }));
    }
  }, []);

  // Main processing function trigger
  const startProcessing = async () => {
    if (!settings.apiKey) {
      setShowSettings(true);
      return;
    }

    setIsProcessing(true);
    
    // 1. Split all Idle images locally first
    const itemsToProcess = items.filter(
        i => i.splitPart1.status === ProcessStatus.Idle && i.splitPart2.status === ProcessStatus.Idle
    );

    for (const item of itemsToProcess) {
       setItems(prev => prev.map(i => i.id === item.id ? {
           ...i, 
           splitPart1: {...i.splitPart1, status: ProcessStatus.Splitting},
           splitPart2: {...i.splitPart2, status: ProcessStatus.Splitting}
       } : i));

       try {
           const [part1, part2] = await splitImage(item.originalUrl, splitDirection);
           
           setItems(prev => prev.map(i => i.id === item.id ? {
               ...i, 
               splitPart1: {...i.splitPart1, url: part1, status: ProcessStatus.Idle},
               splitPart2: {...i.splitPart2, url: part2, status: ProcessStatus.Idle}
           } : i));

           // Pass settings to the processor
           processImagePart(item.id, 1, part1, settings);
           processImagePart(item.id, 2, part2, settings);

       } catch (e) {
           console.error("Splitting error", e);
       }
    }
    
    setIsProcessing(false);
  };

  const retryPart = (id: string, part: 1 | 2) => {
    if (!settings.apiKey) {
        setShowSettings(true);
        return;
    }
    const item = items.find(i => i.id === id);
    if (!item) return;
    
    const partData = part === 1 ? item.splitPart1 : item.splitPart2;
    if (partData.url) {
        processImagePart(id, part, partData.url, settings);
    }
  };

  const removeItem = (id: string) => {
      setItems(prev => prev.filter(item => item.id !== id));
  };

  const clearAll = () => {
    if(window.confirm("确定要清空所有图片吗？")) {
        setItems([]);
    }
  }

  return (
    <div className="min-h-screen p-6 md:p-12 max-w-7xl mx-auto selection:bg-indigo-500/30">
      <div className="fixed top-0 left-0 w-full h-96 bg-indigo-900/20 blur-[120px] rounded-full pointer-events-none -z-10 opacity-50"></div>
      <div className="fixed bottom-0 right-0 w-96 h-96 bg-purple-900/10 blur-[100px] rounded-full pointer-events-none -z-10"></div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md shadow-2xl p-6 relative">
             <button 
               onClick={() => setShowSettings(false)}
               className="absolute top-4 right-4 text-zinc-500 hover:text-white"
             >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
             </button>

             <h2 className="text-xl font-bold text-white mb-1">API 设置</h2>
             <p className="text-zinc-400 text-sm mb-6">配置您的 Google Gemini API</p>
             
             <form onSubmit={(e) => {
               e.preventDefault();
               const formData = new FormData(e.currentTarget);
               saveSettings({
                 apiKey: formData.get('apiKey') as string,
                 baseUrl: formData.get('baseUrl') as string,
                 modelName: formData.get('modelName') as string,
               });
             }} className="space-y-4">
                
                {/* API Key */}
                <div>
                   <label className="block text-xs font-medium text-zinc-400 mb-1 uppercase tracking-wider">API Key (必填)</label>
                   <input 
                     name="apiKey"
                     defaultValue={settings.apiKey}
                     type="password"
                     placeholder="AIzaSy..."
                     required
                     className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-zinc-700"
                   />
                   <p className="text-[10px] text-zinc-500 mt-1">
                      您的 Key 仅存储在本地浏览器中，绝不上传到服务器。
                   </p>
                </div>

                {/* Advanced Section Divider */}
                <div className="relative py-2">
                   <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-800"></div></div>
                   <div className="relative flex justify-center"><span className="bg-zinc-900 px-2 text-[10px] text-zinc-600 uppercase">高级选项 (可选)</span></div>
                </div>

                {/* Base URL */}
                <div>
                   <label className="block text-xs font-medium text-zinc-400 mb-1 uppercase tracking-wider">API Base URL</label>
                   <input 
                     name="baseUrl"
                     defaultValue={settings.baseUrl}
                     type="text"
                     placeholder="https://generativelanguage.googleapis.com"
                     className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-zinc-700 font-mono text-xs"
                   />
                   <p className="text-[10px] text-zinc-500 mt-1">
                      如果您使用中转代理，请在此填入代理地址。留空则使用官方地址。
                   </p>
                </div>

                 {/* Model Name */}
                 <div>
                   <label className="block text-xs font-medium text-zinc-400 mb-1 uppercase tracking-wider">模型名称</label>
                   <input 
                     name="modelName"
                     defaultValue={settings.modelName}
                     type="text"
                     placeholder="gemini-2.5-flash-image"
                     className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-zinc-700 font-mono text-xs"
                   />
                </div>

                <div className="pt-2">
                   <button 
                     type="submit"
                     className="w-full bg-white text-black font-semibold py-2 rounded-lg hover:bg-zinc-200 transition-colors"
                   >
                     保存设置
                   </button>
                </div>
             </form>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="mb-12 flex flex-col items-center relative">
        <button 
           onClick={() => setShowSettings(true)}
           className="absolute top-0 right-0 p-2 text-zinc-500 hover:text-white transition-colors bg-zinc-800/30 hover:bg-zinc-800 rounded-lg backdrop-blur-sm border border-transparent hover:border-zinc-700"
           title="设置"
        >
           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
             <path fillRule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 00-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 00-2.282.819l-.922 1.597a1.875 1.875 0 00.432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 000 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 00-.432 2.385l.922 1.597a1.875 1.875 0 002.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 002.28-.819l.922-1.597a1.875 1.875 0 00-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 000-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 00-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 00-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 00-1.85-1.567h-1.843zM12 15.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z" clipRule="evenodd" />
           </svg>
        </button>
        
        <h1 className="text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white via-zinc-200 to-zinc-500 drop-shadow-sm mt-4">
          智能拼图拆分与扩图
        </h1>
        <p className="text-zinc-400 max-w-2xl mx-auto text-lg font-light leading-relaxed mt-4 text-center">
          上传拼接的 3:4 图片，AI 自动进行智能拆分，并无缝扩充背景恢复至完美人像比例。
        </p>
      </header>

      {/* Controls Area */}
      <div className="glass-panel rounded-3xl p-8 mb-10 shadow-2xl relative overflow-hidden">
        {/* Glow Line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>

        <div className="flex flex-col md:flex-row gap-8 items-start justify-between mb-8">
            
            {/* Split Settings */}
            <div className="flex flex-col gap-3">
                <span className="text-zinc-400 text-xs font-bold uppercase tracking-widest">拆分模式</span>
                <div className="flex bg-zinc-950/50 p-1.5 rounded-xl border border-zinc-800/50 backdrop-blur-md">
                    <button
                        onClick={() => setSplitDirection(SplitDirection.Horizontal)}
                        className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 ${
                            splitDirection === SplitDirection.Horizontal
                            ? 'bg-zinc-800 text-white shadow-lg ring-1 ring-white/10'
                            : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
                        }`}
                    >
                        左右拆分
                    </button>
                    <button
                        onClick={() => setSplitDirection(SplitDirection.Vertical)}
                        className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 ${
                            splitDirection === SplitDirection.Vertical
                            ? 'bg-zinc-800 text-white shadow-lg ring-1 ring-white/10'
                            : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
                        }`}
                    >
                        上下拆分
                    </button>
                </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3 w-full md:w-auto items-end">
                <span className="text-zinc-400 text-xs font-bold uppercase tracking-widest invisible md:visible">操作</span>
                <div className="flex gap-4 w-full md:w-auto">
                    {items.length > 0 && (
                        <button
                        onClick={clearAll}
                        className="px-5 py-3 rounded-xl border border-red-500/20 text-red-400 hover:bg-red-500/10 hover:border-red-500/40 transition-all text-sm font-medium"
                        >
                        清空列表
                        </button>
                    )}
                    <button
                        onClick={startProcessing}
                        disabled={isProcessing || items.length === 0 || items.every(i => i.splitPart1.status === ProcessStatus.Done || i.splitPart1.status === ProcessStatus.Expanding)}
                        className={`flex-1 md:flex-none px-8 py-3 rounded-xl font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all transform active:scale-95 border border-white/10 ${
                            isProcessing || items.length === 0
                            ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border-transparent shadow-none'
                            : 'bg-gradient-to-br from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 hover:shadow-indigo-500/40'
                        }`}
                    >
                        {isProcessing ? '正在处理中...' : '开始批量处理'}
                    </button>
                </div>
            </div>
        </div>

        <div>
            <Dropzone onFilesAdded={handleFilesAdded} isProcessing={isProcessing} />
        </div>
      </div>

      {/* Results Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {items.map((item) => (
          <ResultCard 
            key={item.id} 
            item={item} 
            onRetry={retryPart}
            onRemove={removeItem}
          />
        ))}
      </div>
      
      {items.length === 0 && (
          <div className="text-center py-20 opacity-30">
              <p className="text-zinc-500 text-sm font-light tracking-widest uppercase">暂无图片，请上传以开始</p>
          </div>
      )}
    </div>
  );
};

export default App;