export enum SplitDirection {
  Horizontal = 'HORIZONTAL', // Left/Right
  Vertical = 'VERTICAL',     // Top/Bottom
}

export enum ProcessStatus {
  Idle = 'IDLE',
  Splitting = 'SPLITTING',
  Expanding = 'EXPANDING',
  Done = 'DONE',
  Error = 'ERROR',
}

export interface ProcessedImage {
  id: string;
  originalUrl: string;
  file: File;
  splitPart1: {
    url: string | null;
    expandedUrl: string | null;
    status: ProcessStatus;
  };
  splitPart2: {
    url: string | null;
    expandedUrl: string | null;
    status: ProcessStatus;
  };
}
