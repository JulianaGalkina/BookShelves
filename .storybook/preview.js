import '../src/style.css';
import './preview.css';

/** @type { import('@storybook/react').Preview } */
const preview = {
  parameters: {
    controls: { expanded: true },
    backgrounds: {
      disable: true,
    },
    layout: 'padded',
  },
};

export default preview;
