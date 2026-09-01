import Konva from "konva";
import { getPoiMarkerRadius, rgbaToObj } from "../src/annotationForm/AnnotationFormOverlay/KonvaDrawing/KonvaUtils";

// The app relies on Konva being available as a global (see getKonvaStage), so mirror that here.
window.Konva = Konva;

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

// Regression coverage for a real bug: POI markers use a hex stroke color ('#ffffff'), but
// rgbaToObj used to assume its input was always a full rgba(...) string and crashed trying to
// read rgbaArray[3] on any other CSS color format (hex, rgb(), named colors) — breaking
// annotation save (via getSvg -> cleanNode) for any shape using such a color.
describe("rgbaToObj", () => {
  it("parses a hex color, defaulting alpha to 1", () => {
    expect(rgbaToObj("#ffffff")).toEqual({
      r: 255, g: 255, b: 255, a: 1
    });
  });

  it("parses an rgb() color with no alpha channel, defaulting alpha to 1", () => {
    expect(rgbaToObj("rgb(229,57,53)")).toEqual({
      r: 229, g: 57, b: 53, a: 1
    });
  });

  it("parses a full rgba() color", () => {
    expect(rgbaToObj("rgba(255,0,0,0.5)")).toEqual({
      r: 255, g: 0, b: 0, a: 0.5
    });
  });
});
