
import { interpolate } from './src/utils/variableInterpolator.js';

const input = '${WEB_PORT:-80}:80';
const env = {}; // No vars
const result = interpolate(input, env);

console.log('Input:', input);
console.log('Result:', JSON.stringify(result, null, 2));

const input2 = '${API_PORT:-3000}:3000';
const result2 = interpolate(input2, env);
console.log('Result2:', JSON.stringify(result2, null, 2));

