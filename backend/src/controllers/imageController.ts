import { Request, Response } from 'express';

export async function uploadImage(req: Request, res: Response): Promise<void> {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'No image file uploaded' });
      return;
    }

    const url = `/uploads/${file.filename}`;

    res.status(201).json({
      url,
      filename: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    });
  } catch (error) {
    console.error('[imageController] uploadImage error:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
}
