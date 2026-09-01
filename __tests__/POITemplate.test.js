import React from 'react';
import { I18nextProvider } from 'react-i18next';
import { i18n } from '../setupTest';
import { fireEvent, render, screen } from './test-utils';
import POITemplate, {
  applyPoiBodyConversion,
  convertPoiAnnotationToBeSaved,
  isValidPointTarget,
} from '../src/annotationForm/templates/builtin/POITemplate';
import { TARGET_TOOL_STATE } from '../src/annotationForm/AnnotationFormUtils';
import { SHAPES_TOOL } from '../src/annotationForm/AnnotationFormOverlay/KonvaDrawing/KonvaUtils';

// tetras-dbf/mirador-annotation-editor#4: the POI template's target must be exactly one drawn
// Circle shape (see docs/superpowers/specs/2026-09-01-poi-iiif-annotation-format-design.md in
// root_repo), so getSvg is mocked the same way MultipleBodyTemplate.test.js mocks it, to keep
// these tests independent of react-konva-to-svg's actual serialization.
vi.mock('../src/annotationForm/AnnotationFormOverlay/KonvaDrawing/KonvaUtils', async () => {
  const actual = await vi.importActual('../src/annotationForm/AnnotationFormOverlay/KonvaDrawing/KonvaUtils');
  return {
    ...actual,
    getSvg: vi.fn().mockResolvedValue('<svg><circle cx="10" cy="20" r="5"/></svg>'),
  };
});

/** A single Circle shape, as drawn by the target toolbar's Circle tool */
const circleShape = () => ({
  fill: TARGET_TOOL_STATE.fillColor,
  fillColor: TARGET_TOOL_STATE.fillColor,
  id: 'shape-1',
  radius: 5,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  stroke: TARGET_TOOL_STATE.strokeColor,
  strokeColor: TARGET_TOOL_STATE.strokeColor,
  type: SHAPES_TOOL.CIRCLE,
  x: 10,
  y: 20,
});

/** A single Rectangle shape - an invalid POI target */
const rectangleShape = () => ({
  fill: TARGET_TOOL_STATE.fillColor,
  fillColor: TARGET_TOOL_STATE.fillColor,
  height: 40,
  id: 'shape-1',
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  stroke: TARGET_TOOL_STATE.strokeColor,
  strokeColor: TARGET_TOOL_STATE.strokeColor,
  type: SHAPES_TOOL.RECTANGLE,
  width: 30,
  x: 10,
  y: 20,
});

const playerReferences = {
  getContainer: vi.fn().mockReturnValue(null),
  getDisplayedMediaHeight: vi.fn().mockReturnValue(100),
  getMediaTrueHeight: vi.fn().mockReturnValue(200),
  getMediaTrueWidth: vi.fn().mockReturnValue(300),
  getMediaType: vi.fn().mockReturnValue('Image'),
  getScale: vi.fn().mockReturnValue(1),
  getZoom: vi.fn().mockReturnValue(1),
};

/** A minimal, valid POITemplate annotationState */
const basePoiState = () => ({
  body: [],
  'dbf:kind': 'POI',
  maeData: {
    descriptionItems: [],
    target: {
      drawingState: { shapes: [circleShape()] },
      fullCanvaXYWH: '0,0,800,600',
    },
    templateType: 'poi',
    title: 'Dome of the Rock',
  },
  motivation: 'identifying',
  target: null,
});

describe('isValidPointTarget', () => {
  it('is true for exactly one Circle shape', () => {
    const maeData = { target: { drawingState: { shapes: [circleShape()] } } };
    expect(isValidPointTarget(maeData)).toBe(true);
  });

  it('is false with no shapes', () => {
    const maeData = { target: { drawingState: { shapes: [] } } };
    expect(isValidPointTarget(maeData)).toBe(false);
  });

  it('is false with a Rectangle shape', () => {
    const maeData = { target: { drawingState: { shapes: [rectangleShape()] } } };
    expect(isValidPointTarget(maeData)).toBe(false);
  });

  it('is false with more than one shape', () => {
    const shapes = [circleShape(), circleShape()];
    expect(isValidPointTarget({ target: { drawingState: { shapes } } })).toBe(false);
  });
});

describe('applyPoiBodyConversion', () => {
  it('builds body with the title as the identifying TextualBody', () => {
    const state = basePoiState();

    const result = applyPoiBodyConversion(state);

    expect(result.body[0]).toEqual({
      purpose: 'identifying',
      type: 'TextualBody',
      value: 'Dome of the Rock',
    });
  });

  it('appends ordered description items, skipping empty ones', () => {
    const state = basePoiState();
    state.maeData.descriptionItems = [
      { key: '1', type: 'TextualBody', value: 'Built in 691 CE' },
      { key: '2', type: 'Image', value: 'https://example.org/dome.jpg' },
      { key: '3', type: 'Sound', value: 'https://example.org/dome.mp3' },
      { key: '4', type: 'TextualBody', value: '' },
    ];

    const result = applyPoiBodyConversion(state);

    expect(result.body.slice(1)).toEqual([
      { purpose: 'describing', type: 'TextualBody', value: 'Built in 691 CE' },
      { id: 'https://example.org/dome.jpg', purpose: 'describing', type: 'Image' },
      { id: 'https://example.org/dome.mp3', purpose: 'describing', type: 'Sound' },
    ]);
  });

  it('leaves an existing dbf:journey/dbf:linkedMap untouched - these are Strapi-managed relations, not editable here', () => {
    const state = basePoiState();
    state['dbf:journey'] = { id: 'journey-1', order: 3 };
    state['dbf:linkedMap'] = { id: 'map-7', type: 'Manifest' };

    const result = applyPoiBodyConversion(state);

    expect(result['dbf:journey']).toEqual({ id: 'journey-1', order: 3 });
    expect(result['dbf:linkedMap']).toEqual({ id: 'map-7', type: 'Manifest' });
  });

  it('does not add dbf:journey/dbf:linkedMap when the annotation never had them', () => {
    const result = applyPoiBodyConversion(basePoiState());

    expect(result).not.toHaveProperty('dbf:journey');
    expect(result).not.toHaveProperty('dbf:linkedMap');
  });
});

describe('convertPoiAnnotationToBeSaved', () => {
  it('preserves motivation and dbf:kind, and derives target from the drawn circle', async () => {
    const state = basePoiState();

    const result = await convertPoiAnnotationToBeSaved(
      state,
      { canvas: { id: 'canvas1' }, playerReferences, windowId: 'window1' },
    );

    expect(result.motivation).toBe('identifying');
    expect(result['dbf:kind']).toBe('POI');
    expect(result.target).toEqual({
      selector: [
        { type: 'SvgSelector', value: '<svg><circle cx="10" cy="20" r="5"/></svg>' },
        { type: 'FragmentSelector', value: 'canvas1#' },
      ],
      source: 'canvas1',
    });
  });
});

describe('POITemplate (render)', () => {
  /** Identity translation stub, matching exampleExternalTemplate.test.js's convention */
  const mockT = (key) => key;

  /** Render POITemplate wrapped the same way exampleExternalTemplate.test.js does */
  const renderPoiTemplate = (annotation = {}, saveAnnotation = vi.fn()) => render(
    <I18nextProvider i18n={i18n}>
      <POITemplate
        annotation={annotation}
        closeFormCompanionWindow={vi.fn()}
        playerReferences={playerReferences}
        saveAnnotation={saveAnnotation}
        t={mockT}
        windowId="window1"
      />
    </I18nextProvider>,
    { preloadedState: { config: { annotation: {} } } },
  );

  it('does not save and shows an error when the target is not a single point', () => {
    const saveAnnotation = vi.fn();
    renderPoiTemplate({}, saveAnnotation);

    fireEvent.click(screen.getByRole('button', { name: 'save' }));

    expect(saveAnnotation).not.toHaveBeenCalled();
    expect(screen.getByText('poi_target_must_be_point')).toBeInTheDocument();
  });

  it('adds and removes a description item', () => {
    renderPoiTemplate();

    expect(screen.queryAllByLabelText('poi_remove_description_item')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'poi_add_description_item' }));
    expect(screen.getAllByLabelText('poi_remove_description_item')).toHaveLength(1);

    fireEvent.click(screen.getByLabelText('poi_remove_description_item'));
    expect(screen.queryAllByLabelText('poi_remove_description_item')).toHaveLength(0);
  });

  it('rehydrates title and description items from an existing annotation body', () => {
    renderPoiTemplate({
      body: [
        { purpose: 'identifying', type: 'TextualBody', value: 'Dome of the Rock' },
        { purpose: 'describing', type: 'TextualBody', value: 'Built in 691 CE' },
      ],
      'dbf:kind': 'POI',
      id: 'canvas1/annotation/1',
      maeData: {
        target: { drawingState: JSON.stringify({ shapes: [circleShape()] }) },
        templateType: 'poi',
      },
      motivation: 'identifying',
      target: {
        selector: [{ type: 'SvgSelector', value: '<svg><circle cx="10" cy="20" r="5"/></svg>' }],
        source: 'canvas1',
      },
    });

    expect(screen.getByDisplayValue('Dome of the Rock')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Built in 691 CE')).toBeInTheDocument();
  });
});
