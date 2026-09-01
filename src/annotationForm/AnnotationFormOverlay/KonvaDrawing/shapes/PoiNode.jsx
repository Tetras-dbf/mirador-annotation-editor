import React from 'react';
import PropTypes from 'prop-types';
import { Circle } from 'react-konva';

/**
 * The POI marker shape (tetras-dbf/mirador-annotation-editor#21): a fixed-size, fixed-color
 * circle with no Transformer/resize handles - a POI has no style options and its size is not
 * user-configurable. Always draggable (no separate cursor/edit tool exists for this shape),
 * so a placed marker can be repositioned without switching tools.
 */
function PoiNode({
  handleDragEnd,
  handleDragStart,
  onShapeClick,
  shape,
}) {
  /** Forwards the click to the parent's shape-click handler */
  const handleClick = () => {
    onShapeClick(shape);
  };

  return (
    <Circle
      draggable
      fill={shape.fill}
      id={shape.id}
      onClick={handleClick}
      onDragEnd={handleDragEnd}
      onDragStart={handleDragStart}
      onMousedown={handleClick}
      radius={shape.radius}
      rotation={shape.rotation}
      scaleX={shape.scaleX}
      scaleY={shape.scaleY}
      stroke={shape.stroke}
      // This line cause SVG export error
      strokeScaleEnabled={false}
      strokeWidth={shape.strokeWidth}
      x={shape.x}
      y={shape.y}
    />
  );
}

PoiNode.propTypes = {
  handleDragEnd: PropTypes.func.isRequired,
  handleDragStart: PropTypes.func.isRequired,
  onShapeClick: PropTypes.func.isRequired,
  shape: PropTypes.shape({
    fill: PropTypes.string,
    id: PropTypes.string,
    radius: PropTypes.number,
    rotation: PropTypes.number,
    scaleX: PropTypes.number,
    scaleY: PropTypes.number,
    stroke: PropTypes.string,
    strokeWidth: PropTypes.number,
    x: PropTypes.number,
    y: PropTypes.number,
  }).isRequired,
};

export default PoiNode;
