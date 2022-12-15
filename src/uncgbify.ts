import { inflateRaw, deflate } from 'pako';
import CRC32 from 'crc-32';

const IGNORE_CHUNK_TYPES = ['CgBI', 'iDOT'];

export function unCgBIfy(buffer: ArrayBuffer): ArrayBuffer {
	const decoder = new TextDecoder('utf-8');
	const encoder = new TextEncoder();
	const view = new DataView(buffer);

	if (!hasPNGHeader(view)) {
		throw new Error('Not a PNG file');
	}

	let offset = 8;
	let isCgBICompressed = false;
	let width = -1;
	let height = -1;
	const chunks = [];
	const idatCgbiData: {
		offset: number;
		length: number;
	}[] = [];

	while (offset < view.byteLength) {
		// Read a chunk
		const length = view.getUint32(offset);
		offset += 4;
		const id = decoder.decode(view.buffer.slice(offset, offset + 4));
		offset += 4;
		const data_pos = offset;
		offset += length;
		const crc = view.getUint32(offset);
		offset += 4;
		const chunk = {data_pos, length, id, crc};

		// Analyze chunk
		if (chunk.id === 'CgBI') {
			isCgBICompressed = true;
		}

		// Skip any chunks that we've chosen to ignore
		if (IGNORE_CHUNK_TYPES.includes(chunk.id)) {
			continue;
		}

		// Process chunks as necessary
		if (chunk.id === 'IHDR') {
			width = view.getUint32(chunk.data_pos);
			height = view.getUint32(chunk.data_pos + 4);
		} else if (chunk.id === 'IDAT' && isCgBICompressed) {
			idatCgbiData.push({
				offset: chunk.data_pos,
				length: chunk.length,
			});
			continue; // Discard chunk
		} else if (chunk.id === 'IEND' && isCgBICompressed) {
			// Reinflate
			const idatCgBIDataLength = idatCgbiData.reduce((acc, {length}) => acc+length, 0);
			const idatDataBuffer = new Uint8Array(idatCgBIDataLength);
			for (let i = 0, write = 0; i < idatCgbiData.length; i++) {
				const { offset, length } = idatCgbiData[i];
				idatDataBuffer.set(new Uint8Array(view.buffer.slice(offset, offset+length)), write);
				write += length;
			}

			const inflated = inflateRaw(idatDataBuffer);
			var pixels_view = new DataView(inflated.buffer);

			// Swap red and blue bytes for each pixel
			let i = 0;
			for (let y = 0; y < height; y++) {
				i += 1;
				for (let x = 0; x < width; x++ ) {
					var red = pixels_view.getUint8(i + 0);
					var blue = pixels_view.getUint8(i + 2);
					pixels_view.setUint8(i + 0, blue);
					pixels_view.setUint8(i + 2, red);
					i += 4;
				}
			}

			const idatData = deflate(inflated);

			// Generate new checksum
			let crc = CRC32.buf(encoder.encode('IDAT'));
			crc = CRC32.buf(idatData, crc);
			const chunkCRC = (crc + 0x100000000) % 0x100000000;
			chunks.push({
				id: 'IDAT',
				length: idatData.byteLength,
				data: idatData,
				crc: chunkCRC,
			});
		}
		chunks.push(chunk);
	}

	const output_length = (
		8 + // header data
		chunks.reduce((acc, {length}) => acc + (length + 4 + 4 + 4), 0)
	);

	const output = new Uint8Array(output_length);
	const output_view = new DataView(output.buffer);
	output.set(new Uint8Array(buffer.slice(0, 8)), 0);
	for (let i = 0, len = chunks.length, offset = 8; i < len; i++) {
		const chunk = chunks[i];
		output_view.setUint32(offset, chunk.length);
		offset += 4;
		output.set(encoder.encode(chunk.id), offset);
		offset += 4;
		if ('data_pos' in chunk) {
			const { length, data_pos } = chunk;
			const data = buffer.slice(data_pos, data_pos+length);
			output.set(new Uint8Array(data), offset);
			offset += length;
		} else if ('data' in chunk) {
			const { data, length } = chunk;
			output.set(data, offset);
			offset += length;
		}
		output_view.setUint32(offset, chunk.crc);
		offset += 4;
	}

	return output.buffer;
}


function hasPNGHeader(view: DataView): boolean {
	const png_header_bytes = [0x89, 80, 78, 71, 13, 10, 0x1a, 10];
	for (let i = 0; i < png_header_bytes.length; i++) {
		if (png_header_bytes[i] !== view.getUint8(i)) {
			return false;
		}
	}
	return true;
}
