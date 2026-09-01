import React, { useState } from 'react';
import {
  Button,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from '@mui/material';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import DeleteIcon from '@mui/icons-material/Delete';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import { v4 as uuidv4 } from 'uuid';
import { getConfig } from 'mirador';
import { isValidUrl, TEMPLATE } from '../../AnnotationFormUtils';
import { resizeKonvaStage, SHAPES_TOOL } from '../../AnnotationFormOverlay/KonvaDrawing/KonvaUtils';
import { finalizeSpatialTarget, getDefaultValue, isEmptyValue } from '../../../IIIFUtils';
import { templateKit } from '../kit';

const { AnnotationFormFooter, TargetFormSection } = templateKit;

/** IIIF content-resource types a POI description element can be, matching poi.media's
 * allowedTypes (images/audios) plus plain text - KNOWLEDGEBASE.md §2.4 */
export const DESCRIPTION_ITEM_TYPES = {
  IMAGE: 'Image',
  SOUND: 'Sound',
  TEXT: 'TextualBody',
};

/**
 * A POI's spatial target must be exactly one drawn Circle shape - not a rectangle, polygon, or
 * multiple shapes - so it round-trips as a single point (see
 * docs/superpowers/specs/2026-09-01-poi-iiif-annotation-format-design.md in root_repo). The
 * spatial-target toolbar itself still offers Rectangle/Circle/Polygon (TargetFormSection has no
 * shape-restriction prop), so this is enforced here instead, at save time.
 *
 * KNOWN LIMITATION (not yet reachable - no producer of maeData-less POI annotations exists until
 * strapi-plugins#10 ships): IIIFUtils.js's convertSvgSelectorToMae reconstructs ANY SvgSelector,
 * circle included, as a SHAPES_TOOL.RECTANGLE shape (bounding-box only, no shape-type detection).
 * So a POI created outside MAE, once opened here for the first time, will show/validate as a
 * rectangle - failing this very check - until convertSvgSelectorToMae is taught to recognize a
 * lone <circle> element. Left unfixed here since it would touch shared code with zero test
 * coverage for non-rectangular shapes today; track as a follow-up once strapi-plugins#10 lands.
 * @param maeData
 * @returns {boolean}
 */
export const isValidPointTarget = (maeData) => {
  const shapes = maeData?.target?.drawingState?.shapes;
  return Array.isArray(shapes) && shapes.length === 1 && shapes[0].type === SHAPES_TOOL.CIRCLE;
};

/**
 * Build the saved `body` array (title, then ordered description items) and the top-level
 * dbf:journey / dbf:linkedMap extension properties from maeData. Mirrors
 * applyMultipleBodyConversion's role for MULTIPLE_BODY_TYPE, kept local to this template since
 * (unlike applyMultipleBodyConversion) nothing else needs to share it.
 * @param {object} state
 * @returns {object} the same state, mutated
 */
export const applyPoiBodyConversion = (state) => {
  const stateToSave = state;
  const {
    title, descriptionItems, journeyId, journeyOrder, linkedMapId,
  } = stateToSave.maeData;

  stateToSave.body = [
    {
      purpose: 'identifying',
      type: DESCRIPTION_ITEM_TYPES.TEXT,
      value: isEmptyValue(title) ? getDefaultValue() : title,
    },
    ...descriptionItems
      .filter((item) => !isEmptyValue(item.value))
      .map((item) => (item.type === DESCRIPTION_ITEM_TYPES.TEXT
        ? { purpose: 'describing', type: DESCRIPTION_ITEM_TYPES.TEXT, value: item.value }
        : { id: item.value, purpose: 'describing', type: item.type })),
  ];

  if (journeyId) {
    // journeyOrder comes from a controlled <input type="number">, so its value is always a
    // string (even "0") - `journeyOrder || null` would silently turn a legitimate order of 0
    // into null, and would save "0" (a string) rather than 0 (a number) otherwise.
    const order = journeyOrder === '' || journeyOrder === null || journeyOrder === undefined
      ? null
      : Number(journeyOrder);
    stateToSave['dbf:journey'] = { id: journeyId, order };
  } else {
    delete stateToSave['dbf:journey'];
  }

  if (linkedMapId) {
    stateToSave['dbf:linkedMap'] = { id: linkedMapId, type: 'Manifest' };
  } else {
    delete stateToSave['dbf:linkedMap'];
  }

  return stateToSave;
};

/**
 * Convert a POITemplate annotationState into a savable IIIF annotation: build the body array and
 * dbf:* extension properties (applyPoiBodyConversion), then finalize the spatial target through
 * the same shared pipeline every other spatial-target template uses.
 * @param {object} state
 * @param {{ canvas: object, windowId: string, playerReferences: object }} ctx
 * @returns {Promise<object>}
 */
export const convertPoiAnnotationToBeSaved = async (
  state,
  { canvas, windowId, playerReferences },
) => {
  const stateToSave = applyPoiBodyConversion(state);
  return finalizeSpatialTarget(stateToSave, canvas, windowId, playerReferences);
};

/** POI Template */
export default function POITemplate(
  {
    annotation,
    closeFormCompanionWindow,
    playerReferences,
    saveAnnotation,
    t,
    windowId,
  },
) {
  const config = useSelector((state) => getConfig(state));
  const journeys = config.annotation.journeys ?? [];
  const linkedMaps = config.annotation.linkedMaps ?? [];

  let maeAnnotation = annotation;

  if (!maeAnnotation.id) {
    maeAnnotation = {
      body: [],
      'dbf:kind': 'POI',
      maeData: {
        descriptionItems: [],
        journeyId: '',
        journeyOrder: '',
        linkedMapId: '',
        target: null,
        templateType: TEMPLATE.POI_TYPE,
        title: '',
      },
      motivation: 'identifying',
      target: null,
    };
  } else {
    if (maeAnnotation.maeData.target.drawingState && typeof maeAnnotation.maeData.target.drawingState === 'string') {
      maeAnnotation.maeData.target.drawingState = JSON.parse(
        maeAnnotation.maeData.target.drawingState,
      );
    }
    maeAnnotation.maeData.title = maeAnnotation.body
      .find((body) => body.purpose === 'identifying')?.value ?? '';
    maeAnnotation.maeData.descriptionItems = maeAnnotation.body
      .filter((body) => body.purpose === 'describing')
      .map((body) => ({
        key: uuidv4(),
        type: body.type,
        value: body.type === DESCRIPTION_ITEM_TYPES.TEXT ? body.value : body.id,
      }));
    maeAnnotation.maeData.journeyId = maeAnnotation['dbf:journey']?.id ?? '';
    maeAnnotation.maeData.journeyOrder = maeAnnotation['dbf:journey']?.order ?? '';
    maeAnnotation.maeData.linkedMapId = maeAnnotation['dbf:linkedMap']?.id ?? '';
  }

  const [annotationState, setAnnotationState] = useState(maeAnnotation);
  const [targetError, setTargetError] = useState(false);

  /** Update a top-level maeData field * */
  const updateMaeData = (patch) => {
    setAnnotationState({
      ...annotationState,
      maeData: {
        ...annotationState.maeData,
        ...patch,
      },
    });
  };

  /** Update Target State * */
  const updateTargetState = (target) => {
    updateMaeData({ target });
  };

  /** Add a new blank description item * */
  const addDescriptionItem = () => {
    updateMaeData({
      descriptionItems: [
        ...annotationState.maeData.descriptionItems,
        { key: uuidv4(), type: DESCRIPTION_ITEM_TYPES.TEXT, value: '' },
      ],
    });
  };

  /** Replace one description item * */
  const updateDescriptionItem = (index, newItem) => {
    const items = [...annotationState.maeData.descriptionItems];
    items[index] = newItem;
    updateMaeData({ descriptionItems: items });
  };

  /** Remove one description item * */
  const removeDescriptionItem = (index) => {
    updateMaeData({
      descriptionItems: annotationState.maeData.descriptionItems
        .filter((_item, i) => i !== index),
    });
  };

  /** Move a description item up (-1) or down (+1) in display order * */
  const moveDescriptionItem = (index, delta) => {
    const items = [...annotationState.maeData.descriptionItems];
    const targetIndex = index + delta;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    [items[index], items[targetIndex]] = [items[targetIndex], items[index]];
    updateMaeData({ descriptionItems: items });
  };

  /** Save function * */
  const saveFunction = async () => {
    if (!isValidPointTarget(annotationState.maeData)) {
      setTargetError(true);
      return;
    }
    setTargetError(false);
    resizeKonvaStage(
      windowId,
      playerReferences.getMediaTrueWidth(),
      playerReferences.getMediaTrueHeight(),
      1 / playerReferences.getScale(),
    );
    saveAnnotation(annotationState);
  };

  return (
    <Grid container direction="column" spacing={2}>
      <Grid>
        <Typography variant="formSectionTitle">{t('poi')}</Typography>
      </Grid>
      <Grid>
        <TextField
          fullWidth
          label={t('poi_title')}
          value={annotationState.maeData.title}
          variant="outlined"
          onChange={(event) => updateMaeData({ title: event.target.value })}
        />
      </Grid>
      <Grid>
        <Typography variant="formSectionTitle">{t('poi_description_section')}</Typography>
      </Grid>
      {annotationState.maeData.descriptionItems.map((item, index) => (
        <Grid key={item.key} container spacing={1} alignItems="center">
          <Grid>
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel id={`poi-desc-type-label-${item.key}`}>
                {t('poi_description_item_type')}
              </InputLabel>
              <Select
                labelId={`poi-desc-type-label-${item.key}`}
                label={t('poi_description_item_type')}
                value={item.type}
                onChange={(event) => updateDescriptionItem(
                  index,
                  { ...item, type: event.target.value, value: '' },
                )}
              >
                <MenuItem value={DESCRIPTION_ITEM_TYPES.TEXT}>
                  {t('poi_description_item_type_text')}
                </MenuItem>
                <MenuItem value={DESCRIPTION_ITEM_TYPES.IMAGE}>
                  {t('poi_description_item_type_image')}
                </MenuItem>
                <MenuItem value={DESCRIPTION_ITEM_TYPES.SOUND}>
                  {t('poi_description_item_type_sound')}
                </MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size="grow">
            <TextField
              fullWidth
              multiline={item.type === DESCRIPTION_ITEM_TYPES.TEXT}
              label={item.type === DESCRIPTION_ITEM_TYPES.TEXT
                ? t('poi_description_item_text_value')
                : t('poi_description_item_url_value')}
              value={item.value}
              variant="outlined"
              error={item.type !== DESCRIPTION_ITEM_TYPES.TEXT && !isValidUrl(item.value)}
              helperText={item.type !== DESCRIPTION_ITEM_TYPES.TEXT && !isValidUrl(item.value)
                ? t('invalid_url')
                : undefined}
              onChange={(event) => updateDescriptionItem(
                index,
                { ...item, value: event.target.value },
              )}
            />
          </Grid>
          <Grid>
            <IconButton
              aria-label={t('poi_move_description_item_up')}
              disabled={index === 0}
              onClick={() => moveDescriptionItem(index, -1)}
            >
              <ArrowUpwardIcon fontSize="small" />
            </IconButton>
            <IconButton
              aria-label={t('poi_move_description_item_down')}
              disabled={index === annotationState.maeData.descriptionItems.length - 1}
              onClick={() => moveDescriptionItem(index, 1)}
            >
              <ArrowDownwardIcon fontSize="small" />
            </IconButton>
            <IconButton
              aria-label={t('poi_remove_description_item')}
              onClick={() => removeDescriptionItem(index)}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Grid>
        </Grid>
      ))}
      <Grid>
        <Button startIcon={<AddIcon />} onClick={addDescriptionItem}>
          {t('poi_add_description_item')}
        </Button>
      </Grid>
      <Grid>
        <FormControl fullWidth size="small">
          <InputLabel id="poi-journey-label">{t('poi_journey')}</InputLabel>
          <Select
            labelId="poi-journey-label"
            label={t('poi_journey')}
            value={annotationState.maeData.journeyId}
            onChange={(event) => updateMaeData({ journeyId: event.target.value })}
          >
            <MenuItem value="">{t('poi_journey_none')}</MenuItem>
            {journeys.map((journey) => (
              <MenuItem key={journey.id} value={journey.id}>{journey.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>
      {annotationState.maeData.journeyId && (
        <Grid>
          <TextField
            label={t('poi_journey_order')}
            type="number"
            value={annotationState.maeData.journeyOrder}
            variant="outlined"
            onChange={(event) => updateMaeData({ journeyOrder: event.target.value })}
          />
        </Grid>
      )}
      <Grid>
        <FormControl fullWidth size="small">
          <InputLabel id="poi-linked-map-label">{t('poi_linked_map')}</InputLabel>
          <Select
            labelId="poi-linked-map-label"
            label={t('poi_linked_map')}
            value={annotationState.maeData.linkedMapId}
            onChange={(event) => updateMaeData({ linkedMapId: event.target.value })}
          >
            <MenuItem value="">{t('poi_linked_map_none')}</MenuItem>
            {linkedMaps.map((map) => (
              <MenuItem key={map.id} value={map.id}>{map.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>
      <Grid>
        <TargetFormSection
          onChangeTarget={updateTargetState}
          playerReferences={playerReferences}
          spatialTarget
          target={annotationState.maeData.target}
          windowId={windowId}
        />
        {targetError && (
          <Typography color="error" variant="caption">
            {t('poi_target_must_be_point')}
          </Typography>
        )}
      </Grid>
      <Grid>
        <AnnotationFormFooter
          closeFormCompanionWindow={closeFormCompanionWindow}
          saveAnnotation={saveFunction}
          t={t}
          annotationState={annotationState}
        />
      </Grid>
    </Grid>
  );
}

POITemplate.propTypes = {
  annotation: PropTypes.shape({
    adapter: PropTypes.func,
    body: PropTypes.arrayOf(
      PropTypes.shape({
        type: PropTypes.string,
      }),
    ),
    defaults: PropTypes.objectOf(
      PropTypes.oneOfType(
        [PropTypes.bool, PropTypes.func, PropTypes.number, PropTypes.string],
      ),
    ),
    drawingState: PropTypes.string,
    manifestNetwork: PropTypes.string,
    target: PropTypes.string,
  }).isRequired,
  closeFormCompanionWindow: PropTypes.func.isRequired,
  // eslint-disable-next-line react/forbid-prop-types
  playerReferences: PropTypes.object.isRequired,
  // eslint-disable-next-line react/forbid-prop-types
  saveAnnotation: PropTypes.func.isRequired,
  t: PropTypes.func.isRequired,
  windowId: PropTypes.string.isRequired,
};
