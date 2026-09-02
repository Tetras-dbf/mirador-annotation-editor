import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { styled } from '@mui/material/styles';
import { useSelector } from 'react-redux';
import { getConfig } from 'dbf-mirador';
import { DEFAULT_QUILL_CONFIG } from './utils';

// Styling `ReactQuill` directly with `styled()` mutates the props object MUI/emotion hands to
// it (attachTheme sets `props.theme`), but ReactQuill is a class component whose props object
// React freezes in development - under React 18 that throws "Cannot assign to read only
// property 'theme'" (not reproducible under 19, where React no longer freezes it the same way).
// Styling a plain wrapper div instead avoids emotion ever injecting props into ReactQuill.
const StyledQuillWrapper = styled('div')({
  '& .ql-container': {
    maxWidth: '100%',
    width: '100%',
  },
  '& .ql-editor': {
    maxWidth: '100%',
    minHeight: '150px',
    overflowWrap: 'break-word',
    whiteSpace: 'pre-wrap',
    width: '100%',
    wordBreak: 'break-word',
  },
  maxWidth: '100%',
  width: '100%',
});

/** Rich text editor for annotation body */
function TextEditor({ text, setText }) {
  const quillConfigFromState = useSelector((state) => getConfig(state)?.annotation?.quillConfig);

  // eslint-disable-next-line max-len
  const { formats, modules } = useMemo(() => (quillConfigFromState?.modules && quillConfigFromState?.formats
    ? quillConfigFromState
    : DEFAULT_QUILL_CONFIG), [quillConfigFromState]);
    /**
     * Update local text state from editor HTML.
     * @param {string} html HTML content emitted by the editor.
     */
  const handleChange = (html) => {
    setText(html);
  };

  return (
    <div data-text-editor="name" data-testid="textEditor">
      <StyledQuillWrapper>
        <ReactQuill
          value={text}
          onChange={handleChange}
          placeholder="Your text here"
          bounds='[data-text-editor="name"]'
          modules={modules}
          formats={formats}
        />
      </StyledQuillWrapper>
    </div>
  );
}

TextEditor.propTypes = {
  setText: PropTypes.func.isRequired,
  text: PropTypes.string.isRequired,
};

export default TextEditor;
