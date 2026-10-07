/**
	{
		"api": 1,
		"name": "Timestamp Converter",
		"description": "Make an epoch timestamp (or derivatives) readable.",
		"author": "Fabre Lambeau",
		"icon": "watch",
		"tags": "epoch,timestamp,date,time,converter,unix,pt,duration"
	}
**/

function main(input) {
	const text = input.text.trim();
	let epoch;
	let inputType = "unknown"; // Keep track of how we interpreted the input

	// 1. Check for ISO 8601 Duration (PT...S format)
	const durationRegex = /^PT(\d+(\.\d+)?)S$/i;
	const durationMatch = text.match(durationRegex);

	if (durationMatch) {
		try {
			const seconds = parseFloat(durationMatch[1]);
			epoch = seconds * 1000; // Convert seconds to milliseconds
			inputType = "duration";
		} catch (e) {
			input.postError(`Failed to parse duration: ${e.message}`);
			return;
		}
	} else {
		// 2. Check if the input looks like a mathematical expression
		const mathRegex = /[+\-*/]/;
		const allowedCharsRegex = /^[0-9+\-*/().\sEe]+$/;

		if (mathRegex.test(text) && allowedCharsRegex.test(text)) {
			try {
				epoch = new Function('return ' + text)();
				inputType = "math";
			} catch (e) {
				input.postError(`Math evaluation failed: ${e.message}`);
				return;
			}
		} else {
			// 3. Treat as a plain number
			epoch = Number(text);
			inputType = "number";
		}
	}

	if (typeof epoch !== 'number' || isNaN(epoch) || !isFinite(epoch)) {
		input.postError("Invalid input: Not a valid number, duration (PT...S), or evaluatable expression.");
		return;
	}

	let date;
	let unit = "unknown";

	// Determine the unit or create date directly
	if (inputType === "duration") {
		date = new Date(epoch);
		unit = "milliseconds"; // Since we converted duration seconds to ms
	} else {
		// Use heuristic for numbers or math results
		const nowSeconds = Date.now() / 1000;
		if (epoch > nowSeconds * 1e8) { // Likely nanoseconds
			date = new Date(epoch / 1e6);
			unit = "nanoseconds";
		} else if (epoch > nowSeconds * 1e5) { // Likely microseconds
			date = new Date(epoch / 1e3);
			unit = "microseconds";
		} else if (epoch > nowSeconds * 10) { // Likely milliseconds
			date = new Date(epoch);
			unit = "milliseconds";
		} else if (epoch < nowSeconds * 10) { // Likely seconds
			date = new Date(epoch * 1000);
			unit = "seconds";
		} else {
			input.postError("Could not reliably determine epoch unit from number/expression.");
			return;
		}
	}

	if (isNaN(date.getTime())) {
		input.postError("Invalid date resulted from epoch value.");
		return;
	}

	const isoString = date.toISOString();
    // Add milliseconds back for precision if needed, handling potential trailing zeros
    let precisionSuffix = "";
    if (unit === "milliseconds" || unit === "microseconds" || unit === "nanoseconds") {
        let ms = date.getMilliseconds().toString().padStart(3, '0');
        if (unit === "microseconds") {
            const micros = (epoch % 1e3).toString().padStart(3, '0');
            ms += micros;
            precisionSuffix = `.${ms}Z`
        } else if (unit === "nanoseconds") {
            const micros = Math.floor((epoch % 1e6) / 1e3).toString().padStart(3, '0');
            const nanos = (epoch % 1e3).toString().padStart(3, '0');
            ms += micros + nanos;
            precisionSuffix = `.${ms}Z`
        } else { // milliseconds
             precisionSuffix = `.${ms}Z`
        }

    } else {
        precisionSuffix = "Z" // Standard Zulu time indicator
    }

     // Construct ISO string with potential added precision
    const preciseIsoString = isoString.replace('Z', '').replace(/\.\d{3}$/, '') + precisionSuffix;


	// Use Intl.DateTimeFormat for better human-readable formatting
	const humanReadableOptions = {
		year: 'numeric', month: 'long', day: 'numeric',
		hour: 'numeric', minute: 'numeric', second: 'numeric',
		timeZoneName: 'short',
        hour12: false // Use 24-hour clock for clarity
	};
	const formatter = new Intl.DateTimeFormat(undefined, humanReadableOptions); // Use default locale
	const humanReadable = formatter.format(date);

	// Determine output based on whether the input was the full text or a selection
	const processedText = input.text.trim(); // The text that was actually processed
	const fullEditorText = input.fullText.trim(); // The entire editor content

	if (processedText === fullEditorText) {
		// Input was the entire editor content: Output JSON object
		const outputObject = {
			detected_unit: unit,
			iso_8601: preciseIsoString,
			human_readable: humanReadable,
			input_type: inputType // Also include how the input was interpreted
		};
		// Replace the full text with the JSON result
		input.fullText = JSON.stringify(outputObject, null, 2);
	} else {
		// Input was a selection: Output only the ISO string
		// Replace the selection (input.text refers to selection here)
		input.text = preciseIsoString;
	}
} 