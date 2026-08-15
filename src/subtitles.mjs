function cueText(value) {
  return String(value || '').replace(/\s+/g, '').trim();
}

function validCue(value) {
  const startSec = Number(value?.startSec);
  const endSec = Number(value?.endSec);
  const text = String(value?.text || '').trim();
  return Number.isFinite(startSec) && Number.isFinite(endSec) && endSec > startSec && text
    ? { startSec, endSec, text }
    : null;
}

function splitPhrases(value) {
  return String(value || '').match(/[^，,。！？!?；;]+[，,。！？!?；;]?/g)?.map((item) => item.trim()).filter(Boolean) || [];
}

function containsCue(parent, child) {
  return parent !== child
    && child.startSec >= parent.startSec - 0.05
    && child.endSec <= parent.endSec + 0.05
    && cueText(parent.text).length > cueText(child.text).length;
}

/**
 * DashScope may return the full transcript, sentence entries and word entries in
 * the same nested response. Keep one readable sentence/phrase layer instead of
 * rendering all levels on top of each other.
 */
export function normalizeSubtitleCues(values, fallbackText = '') {
  const cues = (Array.isArray(values) ? values : []).map(validCue).filter(Boolean)
    .filter((cue, index, list) => index === list.findIndex((item) => item.startSec === cue.startSec && item.endSec === cue.endSec && item.text === cue.text));
  if (!cues.length) return [];

  const parent = [...cues]
    .sort((left, right) => cueText(right.text).length - cueText(left.text).length)
    .find((candidate) => cues.filter((cue) => containsCue(candidate, cue)).length >= 2);
  if (!parent) return cues.sort((left, right) => left.startSec - right.startSec || left.endSec - right.endSec);

  const descendants = cues.filter((cue) => containsCue(parent, cue));
  const leaves = descendants.filter((candidate) => !descendants.some((cue) => containsCue(candidate, cue)))
    .sort((left, right) => left.startSec - right.startSec || left.endSec - right.endSec);
  const parentText = String(parent.text || fallbackText).trim();
  const phrases = splitPhrases(parentText);
  if (!leaves.length || !phrases.length) return [parent];

  const leafText = cueText(leaves.map((cue) => cue.text).join(''));
  const completeText = cueText(parentText).replace(/[，,。！？!?；;]/g, '');
  if (!leafText || !(leafText.includes(completeText) || completeText.includes(leafText))) return [parent];

  const result = [];
  let leafIndex = 0;
  for (let phraseIndex = 0; phraseIndex < phrases.length && leafIndex < leaves.length; phraseIndex += 1) {
    const phrase = phrases[phraseIndex];
    const targetLength = Math.max(1, cueText(phrase).replace(/[，,。！？!?；;]/g, '').length);
    const startIndex = leafIndex;
    let consumed = 0;
    while (leafIndex < leaves.length && (consumed < targetLength || phraseIndex === phrases.length - 1)) {
      consumed += cueText(leaves[leafIndex].text).replace(/[，,。！？!?；;]/g, '').length;
      leafIndex += 1;
      if (phraseIndex < phrases.length - 1 && consumed >= targetLength) break;
    }
    result.push({ startSec: leaves[startIndex].startSec, endSec: leaves[leafIndex - 1].endSec, text: phrase });
  }
  return result.length ? result : [parent];
}
