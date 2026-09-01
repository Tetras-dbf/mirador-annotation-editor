import { getPoiMarkerRadius } from '../src/annotationForm/AnnotationFormOverlay/KonvaDrawing/KonvaUtils';

// Regression coverage for a real bug caught in review (tetras-dbf/mirador-annotation-editor#21):
// Math.max/Math.min propagate NaN, so an unset/zero media dimension used to produce an
// invisible, NaN-radius POI marker instead of a sane fallback.
describe('getPoiMarkerRadius', () => {
  it('is proportional to the smaller media dimension, clamped between 6 and 40', () => {
    expect(getPoiMarkerRadius(2000, 1000)).toBe(15); // 1000 * 0.015
    expect(getPoiMarkerRadius(100, 100)).toBe(6); // clamped to the floor
    expect(getPoiMarkerRadius(10000, 10000)).toBe(40); // clamped to the ceiling
  });

  it.each([
    [0, 0],
    [undefined, undefined],
    [NaN, 500],
    [-100, 500],
  ])('falls back to a sane default instead of NaN for dimensions (%p, %p)', (w, h) => {
    expect(getPoiMarkerRadius(w, h)).toBe(10);
  });
});
