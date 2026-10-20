import {
  rows,
  securityRows,
  securitySummary,
  summary,
  images,
} from '../../example/src/resultParser';
import { kindLabel, cropRectForGuide, mapViewRectToImage, mappingImageSize, passportGuideRect, sourceLabel } from '../resultParser';

const golden = JSON.stringify({
  identity: { class: 'Passport', country: 'UTO', score: 0.91 },
  readings: [
    { name: 'familyName', value: 'DOE', origin: 'visual', score: 0.97 },
    { name: 'docNumber', value: '123456789', origin: 'zone', score: 0.99 },
  ],
  tests: [
    { name: 'expiry', group: 'validity', outcome: 'pass' },
    { name: 'focus', group: 'capture', outcome: 'pass', score: 0.9 },
    { name: 'foilCheck', group: 'authenticity', page: 0, outcome: 'pass', score: 0.88 },
  ],
  images: [
    {
      name: 'face',
      page: 0,
      data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    },
  ],
  session: { code: 0, detail: 'ready' },
});

function rowValue(raw: string, key: string): string | undefined {
  return rows(raw).find((r) => r.key === key)?.value;
}

describe('resultParser customer JSON', () => {
  it('reads identity + readings + tests', () => {
    expect(rowValue(golden, 'class')).toBe('Passport');
    expect(rowValue(golden, 'familyName')).toMatch(/DOE/);
    expect(rows(golden).find((r) => r.key === 'familyName')?.source).toBe('visual');
    expect(rows(golden).find((r) => r.key === 'expiry')?.source).toBe('validity');
    expect(summary(golden)).toContain('Passport');
    expect(rows(golden).some((r) => r.key === 'foilCheck')).toBe(false);
    expect(JSON.parse(golden).documentName).toBeUndefined();
  });
});

describe('liveness tab mapping', () => {
  it('reads group=authenticity checks', () => {
    expect(securitySummary(golden)).toContain('Passport');
    const parsed = securityRows(golden);
    expect(parsed[0]).toMatchObject({
      page: 'Front',
      check: 'foilCheck',
    });
    expect(parsed[0]?.status).toMatch(/pass/);
  });

  it('explains missing liveness when the payload has none', () => {
    const empty = '{"session":{"code":0,"detail":"ready"},"identity":{},"readings":[],"tests":[],"images":[]}';
    expect(securitySummary(empty)).toContain('this license may not include liveness');
    expect(securityRows(empty)).toEqual([]);
  });
});

describe('images', () => {
  it('renders the fixture without a native library', () => {
    expect(images(golden)).toHaveLength(1);
    expect(images(golden)[0]?.category).toContain('face');
  });
});

describe('customer-facing labels', () => {
  it('never says Security or Authenticity', () => {
    expect(sourceLabel('visual')).toBe('VISUAL');
    expect(sourceLabel('code')).toBe('CODE');
    expect(kindLabel('validity')).toBe('Validity');
    expect(kindLabel('capture')).toBe('Capture');
    expect(kindLabel('security')).toBe('Liveness');
    expect(kindLabel('authenticity')).toBe('Liveness');
  });
});

describe('camera overlay vs crop view size', () => {
  it('window size and preview layout produce different crop rects', () => {
    const window = { w: 390, h: 844 };
    const layout = { w: 390, h: 760 };
    const imageW = 1080;
    const imageH = 1920;
    const overlayWindow = mapViewRectToImage(
      passportGuideRect(window.w, window.h),
      window.w,
      window.h,
      imageW,
      imageH
    );
    const overlayLayout = mapViewRectToImage(
      passportGuideRect(layout.w, layout.h),
      layout.w,
      layout.h,
      imageW,
      imageH
    );
    expect(overlayWindow).not.toEqual(overlayLayout);
    expect(overlayLayout).toEqual(
      mapViewRectToImage(passportGuideRect(layout.w, layout.h), layout.w, layout.h, imageW, imageH)
    );
  });

  it('guide crop is the overlay fraction of the cover-visible still', () => {
    const view = { w: 390, h: 760 };
    const imageW = 1080;
    const imageH = 1920;
    const guide = passportGuideRect(view.w, view.h);
    const visible = mapViewRectToImage(
      { left: 0, top: 0, width: view.w, height: view.h },
      view.w,
      view.h,
      imageW,
      imageH
    );
    const crop = cropRectForGuide(view.w, view.h, imageW, imageH);
    expect(crop.width / visible.width).toBeCloseTo(guide.width / view.w, 1);
    expect(crop.height / visible.height).toBeCloseTo(guide.height / view.h, 1);
  });

  it('JPEG vs preview aspect uses displayed preview for the crop', () => {
    const view = { w: 390, h: 760 };
    const jpegW = 2000;
    const jpegH = 4000;
    const preview = { width: 1080, height: 1920 };
    const map = mappingImageSize(jpegW, jpegH, preview);
    expect(map.width / map.height).toBeCloseTo(preview.width / preview.height, 1);
    const withPreview = cropRectForGuide(view.w, view.h, jpegW, jpegH, preview);
    const fullJpeg = cropRectForGuide(view.w, view.h, jpegW, jpegH);
    expect(withPreview.width).toBeLessThan(fullJpeg.width + 1);
  });
});
