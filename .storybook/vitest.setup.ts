import { beforeAll } from 'vitest';
import { setProjectAnnotations } from '@storybook/nextjs-vite';
import * as previewAnnotations from './preview';

// Storybook 10.3 claims the addon auto-applies these via the Vitest plugin,
// but in practice (SB 10.3.5, @storybook/addon-vitest 10.3.5) removing this
// call drops render functions and every story play fails with
// SB_PREVIEW_API_0014. Leaving it in place. The duplicate-registration
// warning at startup is cosmetic.
const annotations = setProjectAnnotations([previewAnnotations.default]);

beforeAll(annotations.beforeAll);
