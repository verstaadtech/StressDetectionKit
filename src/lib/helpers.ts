import {
  APP_NAME,
  HIGH_STRESS_COLOR,
  LOW_STRESS_COLOR,
  MEDIUM_STRESS_COLOR,
  NONE_STRESS_COLOR
} from 'lib/constants';
import { Device, Reading } from 'lib/device-kit';
import { Sample, StressLevel, StressMark } from 'lib/types';
import { Alert } from 'react-native';
import RNFS from 'react-native-fs';
import { DOMParser } from 'xmldom';

export function chunkBySize<T>(array: T[], size: number) {
  const results: T[][] = [];

  for (let i = 0; i < array.length; i += size) {
    results.push(array.slice(i, i + size));
  }

  return results;
}

export function chunkByPattern<T>(
  array: T[],
  pattern: (elem: T, index: number, array: T[]) => any
) {
  const results: T[][] = [[array[0]]];

  for (let i = 1, state = pattern(array[0], 0, array); i < array.length; i++) {
    const current = pattern(array[i], i, array);

    if (state === current || isNaN(state)) {
      results[results.length - 1].push(array[i]);
    } else {
      state = current;
      results.push([array[i]]);
    }
  }

  return results;
}

export function calcOffsets<T>(array: T[][]) {
  const { offsets } = array
    .map(c => c.length)
    .reduce(
      ({ acc, offsets }, c) => ({ acc: acc + c, offsets: [...offsets, acc] }),
      {
        acc: 0,
        offsets: [] as number[]
      }
    );

  return offsets;
}

export function stressColor(level: StressLevel) {
  switch (level) {
    case 'none':
      return NONE_STRESS_COLOR;
    case 'low':
      return LOW_STRESS_COLOR;
    case 'medium':
      return MEDIUM_STRESS_COLOR;
    case 'high':
      return HIGH_STRESS_COLOR;
  }
}

export function deviceTitle(device: Device) {
  return `${device.name} by ${device.manufacturer}`;
}

export function confirmAction(fn: () => void, msg?: string) {
  Alert.alert('Are you sure?', msg, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'OK', onPress: fn }
  ]);
}

// Extract strings from XML
function getTextContent(node: Document | Element, tag: string) {
  return node.getElementsByTagName(tag)[0].textContent!.trim();
}

// Apply quality and split the stream to points
function processStream(originalPoints: number[], originalQuality: number[]) {
  const points = chunkBySize(originalPoints, 2);
  const quality = chunkBySize(originalQuality, 2);
  return points.filter((p, i) => quality[i][0] === 255);
}

export function readingToStreams(reading: Reading) {
  const doc = new DOMParser().parseFromString(reading.data);

  // According to MedM there is always only one chunk in the reading
  const chunk = doc.getElementsByTagName('chunk')[0];

  const start =
    Date.parse(getTextContent(doc, 'measured-at')) +
    parseInt(getTextContent(chunk, 'start'));

  const {
    pulse,
    pulse_quality,
    rr_intervals,
    rr_intervals_quality
  } = JSON.parse(getTextContent(chunk, 'heartrate')).irregular;

  const pulseStream = processStream(pulse, pulse_quality).map(p => ({
    pulse: p[0],
    timestamp: start + p[1]
  }));

  const rrIntervalsStream = processStream(
    rr_intervals,
    rr_intervals_quality
  ).map(p => ({
    rrInterval: p[0],
    timestamp: start + p[1]
  }));

  return { pulse: pulseStream, rrIntervals: rrIntervalsStream };
}

// Persist data to disk to the application folder
export function persist(
  folder: string,
  filename: string,
  data: any
): Promise<void> {
  const path = `${RNFS.ExternalStorageDirectoryPath}/${APP_NAME}/${folder}`;
  return RNFS.mkdir(path).then(() =>
    RNFS.writeFile(`${path}/${filename}`, JSON.stringify(data), 'ascii')
  );
}

// Filter samples from unreliable samples
export function filterSamples(samples: Sample[], stress: StressMark[]) {
  // TODO
  return samples;
}
