import { MediaItem } from '@/types/post';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function saveFile(
    file: File,
    options?: { maxSize?: number }
): Promise<MediaItem | null> {
    try {
        // Validate file
        if (!file || typeof file.arrayBuffer !== 'function') {
            return null;
        }

        // File size validation (default max 10MB, overridable per caller e.g. video)
        const maxSize = options?.maxSize ?? 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            console.error('File too large:', file.size);
            return null;
        }

        // File type validation (basic check by MIME prefix)
        const allowedTypes = ['image/', 'video/'];
        const isValidType = allowedTypes.some(type => file.type.startsWith(type));
        if (!isValidType) {
            console.error('Invalid file type:', file.type);
            return null;
        }

        // Create uploads directory if it doesn't exist
        const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
        await mkdir(uploadsDir, { recursive: true });

        // Convert file to buffer
        const buffer = Buffer.from(await file.arrayBuffer());
        
        // Generate unique filename with proper extension
        const fileExtension = path.extname(file.name);
        const baseName = path.basename(file.name, fileExtension).replaceAll(' ', '_');
        const fileName = `${Date.now()}_${baseName}${fileExtension}`;
        const filePath = path.join(uploadsDir, fileName);
        
        // Save file
        await writeFile(filePath, buffer);
        const mediaUrl = `/uploads/${fileName}`;
    
        return {
            type: file.type.startsWith('image/') ? 'image' : 
                  file.type.startsWith('video/') ? 'video' : 'file',
            url: mediaUrl,
            alt: file.name,
            size: file.size,
            uploadedAt: new Date()
        };
    } catch (error) {
        console.error('Error saving file:', error);
        return null;
    }
}