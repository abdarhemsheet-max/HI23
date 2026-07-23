import path from 'path';

/** مجلد تخزين المستندات المرفوعة — داخل مجلد المشروع، خارج public */
export const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
