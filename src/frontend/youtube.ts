// أدوات يوتيوب — استخراج معرف الفيديو والصورة المصغرة بدون أي API خارجي

/** استخراج معرف فيديو يوتيوب من أي صيغة رابط شائعة */
export function youtubeVideoId(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1).split('/')[0];
      return id || null;
    }
    if (host.endsWith('youtube.com')) {
      const v = u.searchParams.get('v');
      if (v) return v;
      const m = u.pathname.match(/\/(embed|shorts|live)\/([\w-]{6,})/);
      if (m) return m[2];
    }
  } catch {
    /* رابط غير صالح — نتجاهله بأمان */
  }
  return null;
}

export function isYouTube(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return host === 'youtu.be' || host.endsWith('youtube.com');
  } catch {
    return false;
  }
}

/** رابط الصورة المصغرة للفيديو (يعمل بدون مفتاح API) */
export function youtubeThumb(url: string | null | undefined): string | null {
  const id = youtubeVideoId(url);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}
