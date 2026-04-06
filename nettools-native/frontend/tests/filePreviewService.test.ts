import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FilePreviewService } from '../src/core/storage/filePreviewService';

describe('FilePreviewService', () => {
  let filePreviewService: FilePreviewService;
  
  beforeEach(() => {
    filePreviewService = new FilePreviewService();
    vi.clearAllMocks();
  });
  
  describe('getPreviewType', () => {
    it('should return image for image files', () => {
      expect(filePreviewService.getPreviewType('image.jpg')).toBe('image');
      expect(filePreviewService.getPreviewType('image.png')).toBe('image');
      expect(filePreviewService.getPreviewType('image.gif')).toBe('image');
    });
    
    it('should return text for text files', () => {
      expect(filePreviewService.getPreviewType('file.txt')).toBe('text');
      expect(filePreviewService.getPreviewType('file.js')).toBe('text');
      expect(filePreviewService.getPreviewType('file.json')).toBe('text');
    });
    
    it('should return pdf for pdf files', () => {
      expect(filePreviewService.getPreviewType('document.pdf')).toBe('pdf');
    });
    
    it('should return text for markdown files', () => {
      expect(filePreviewService.getPreviewType('document.md')).toBe('text');
      expect(filePreviewService.getPreviewType('document.markdown')).toBe('text');
    });
    
    it('should return office for office files', () => {
      expect(filePreviewService.getPreviewType('document.docx')).toBe('office');
      expect(filePreviewService.getPreviewType('document.xlsx')).toBe('office');
      expect(filePreviewService.getPreviewType('document.pptx')).toBe('office');
    });
    
    it('should return unknown for unknown file types', () => {
      expect(filePreviewService.getPreviewType('file.unknown')).toBe('unknown');
      expect(filePreviewService.getPreviewType('file')).toBe('unknown');
    });
  });
  
  describe('previewFile', () => {
    it('should preview image file', async () => {
      const blob = new Blob(['image content'], { type: 'image/jpeg' });
      const result = await filePreviewService.previewFile(blob, 'image.jpg');
      expect(result.data?.type).toBe('image');
      expect(result.data?.content).toBe(blob);
    });
    
    it('should preview text file', async () => {
      const blob = new Blob(['text content'], { type: 'text/plain' });
      const result = await filePreviewService.previewFile(blob, 'file.txt');
      expect(result.data?.type).toBe('text');
      expect(result.data?.content).toBe('text content');
    });
    
    it('should preview markdown file', async () => {
      const blob = new Blob(['# Markdown content'], { type: 'text/markdown' });
      const result = await filePreviewService.previewFile(blob, 'document.md');
      expect(result.data?.type).toBe('text');
      expect(result.data?.content).toBe('# Markdown content');
    });
    
    it('should preview pdf file', async () => {
      const blob = new Blob(['pdf content'], { type: 'application/pdf' });
      const result = await filePreviewService.previewFile(blob, 'document.pdf');
      expect(result.data?.type).toBe('pdf');
      expect(result.data?.content).toBe(blob);
    });
    
    it('should preview office file', async () => {
      const blob = new Blob(['office content'], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      const result = await filePreviewService.previewFile(blob, 'document.docx');
      expect(result.data?.type).toBe('office');
      expect(result.data?.content).toBe(blob);
    });
    
    it('should handle unknown file type', async () => {
      const blob = new Blob(['unknown content'], { type: 'application/octet-stream' });
      const result = await filePreviewService.previewFile(blob, 'file.unknown');
      expect(result.data?.type).toBe('unknown');
      expect(result.data?.content).toBe('unknown content');
    });
    
    it('should handle error when previewing file', async () => {
      const blob = {
        text: () => Promise.reject(new Error('Failed to read blob')),
      } as any;
      const result = await filePreviewService.previewFile(blob, 'file.txt');
      expect(result.data?.type).toBe('unknown');
      expect(result.data?.content).toBe('');
      expect(result.error).toBe('Failed to read blob');
    });
  });
  
  describe('generatePreviewUrl', () => {
    it('should generate preview URL', () => {
      const blob = new Blob(['content'], { type: 'text/plain' });
      const url = filePreviewService.generatePreviewUrl(blob);
      expect(url).toMatch(/^blob:/);
    });
  });
  
  describe('revokePreviewUrl', () => {
    it('should revoke preview URL', () => {
      const revokeObjectURlSpy = vi.spyOn(URL, 'revokeObjectURL');
      const blob = new Blob(['content'], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      filePreviewService.revokePreviewUrl(url);
      expect(revokeObjectURlSpy).toHaveBeenCalledWith(url);
    });
  });
});
