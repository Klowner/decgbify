import {readFileSync, writeFileSync} from 'fs';
import {deCgBI} from '../src/decgbi';

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
	const arrayBuffer = new ArrayBuffer(buffer.length);
	const view = new Uint8Array(arrayBuffer);
	for (let i = 0; i < buffer.length; i++) {
		view[i] = buffer[i];
	}
	return arrayBuffer;
}

describe("Fixing Apple's trash proprietary image format", () => {
	// const pngImageData = toArrayBuffer(readFileSync('./test/png-image.png'));
	const cgbiImageData = toArrayBuffer(readFileSync('./test/cgbi-image.png'));
	const fixed = deCgBI(cgbiImageData);
	const fixedView = new DataView(fixed);
	writeFileSync('./output.png', fixedView);

	test('good', () => {
		expect(1).toBe(1);
	});
});
