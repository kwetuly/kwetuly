// The welcome slides are shown once, on first launch, to people who are not signed in.
const KEY = 'rafrika.introSeen';

export const introSeen = () => globalThis.localStorage?.getItem(KEY) === '1';
export const markIntroSeen = () => globalThis.localStorage?.setItem(KEY, '1');
